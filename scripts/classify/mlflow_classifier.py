#!/usr/bin/env python3
"""
MLflow Endpoint-Aware Attack Classifier
=========================================
Supplements CRS pattern matching for MLflow Tracking Server v2.9.2.
Classifies application-specific attacks that CRS regex patterns miss
(path traversal via artifacts, SSRF via artifact_location, RCE via
malicious experiment/run names, info disclosure, etc.)
and provides application-aware success detection.

Two entry points:
  1. classify_request(entry) -> fallback for CRS "others" classification
  2. reevaluate_success(entry, family) -> re-check success for CRS-classified entries

Works for victim_type="mlflow" only. Other victims use CRS-only pipeline.

Known CVEs targeted:
  - CVE-2024-27132: RCE via malicious experiment/run names
  - CVE-2024-37059: Path traversal via artifact endpoints
  - CVE-2024-37060: SSRF via artifact_location in experiments/model versions
"""
import json
import re
from urllib.parse import unquote, urlparse
from typing import Optional


# MLflow known internal hosts
_INTERNAL_HOSTS = frozenset({
    "localhost", "127.0.0.1", "0.0.0.0",
    "victim", "mlflow", "169.254.169.254", "metadata.google",
})

# SSRF target patterns (private/internal IPs and metadata endpoints)
_SSRF_TARGETS = re.compile(
    r'(?:localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.\d+\.\d+|'
    r'\[::1\]|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|'
    r'192\.168\.\d+\.\d+|metadata\.google|169\.254\.169\.254)',
    re.IGNORECASE
)

# CAPEC / CWE mappings for families
_CAPEC = {
    "csrf": "CAPEC-62", "idor": "CAPEC-1", "file_upload": "CAPEC-17",
    "info_disclosure": "CAPEC-118", "auth_bypass": "CAPEC-115",
    "path_traversal": "CAPEC-126", "ssrf": "CAPEC-664", "cmdi": "CAPEC-88",
    "xss": "CAPEC-86", "sqli": "CAPEC-66", "deserialization": "CAPEC-586",
}
_CWE = {
    "csrf": "CWE-352", "idor": "CWE-639", "file_upload": "CWE-434",
    "info_disclosure": "CWE-200", "auth_bypass": "CWE-287",
    "path_traversal": "CWE-22", "ssrf": "CWE-918", "cmdi": "CWE-78",
    "xss": "CWE-79", "sqli": "CWE-89", "deserialization": "CWE-502",
}


# --- Helper functions --------------------------------------------------------

def _label(family: str, rules: list, success: bool, evidence: str) -> dict:
    """Create standardized attack label dict."""
    return {
        "family": family,
        "matched_rules": rules,
        "capec_id": _CAPEC.get(family, ""),
        "cwe_id": _CWE.get(family, ""),
        "success": success,
        "success_evidence": evidence,
    }


def _parse_request(entry: dict):
    """Parse common fields from HTTP entry."""
    req = entry.get("request", {})
    resp = entry.get("response") or {}
    method = str(req.get("method", "")).upper()
    url = str(req.get("url", ""))
    path = str(req.get("path", url))
    body = str(req.get("body", ""))
    headers = req.get("headers", {})
    status = resp.get("status_code", 0)
    resp_body = str(resp.get("body", ""))
    resp_headers = resp.get("headers", {})

    path_clean = path.split("?")[0].rstrip("/").lower()
    query = path.split("?", 1)[1] if "?" in path else ""

    try:
        decoded_path = unquote(unquote(path))
    except Exception:
        decoded_path = path

    return (method, url, path, path_clean, query, body, headers,
            status, resp_body, resp_headers, decoded_path)


def _parse_json_body(body: str) -> dict:
    """Attempt to parse request body as JSON. Returns empty dict on failure."""
    if not body or not body.strip():
        return {}
    try:
        parsed = json.loads(body)
        if isinstance(parsed, dict):
            return parsed
        return {}
    except (json.JSONDecodeError, ValueError):
        return {}


def _is_mlflow_api_path(path_clean: str) -> bool:
    """Check if path is an MLflow API endpoint."""
    return (path_clean.startswith("/api/2.0/mlflow")
            or path_clean.startswith("/ajax-api/2.0/mlflow"))


def _has_traversal_sequences(text: str) -> bool:
    """Check if text contains path traversal sequences."""
    if not text:
        return False
    decoded = text
    try:
        decoded = unquote(unquote(text))
    except Exception:
        pass
    return bool(re.search(r'(?:\.\./|\.\.\\|%2e%2e|%252e%252e|\.\.%2f|\.\.%5c)', decoded, re.IGNORECASE)
                or ".." in decoded)


# --- Main classify_request -- fallback when CRS returns "others" -------------

def classify_request(entry: dict) -> Optional[dict]:
    """
    Classify an HTTP request using MLflow endpoint knowledge.
    Called when CRS pattern matching returns family="others".

    Returns attack_label dict (with success already evaluated) or None.
    """
    (method, url, path, path_clean, query, body, headers,
     status, resp_body, resp_headers, decoded_path) = _parse_request(entry)

    # Try each detector in priority order
    for detector in (_detect_path_traversal, _detect_ssrf, _detect_cmdi,
                     _detect_sqli, _detect_info_disclosure, _detect_file_upload):
        result = detector(method, url, path, path_clean, query, body,
                          headers, status, resp_body, resp_headers, decoded_path)
        if result is not None:
            return result

    return None


# --- reevaluate_success -- second-chance success check for CRS-classified entries ---

def reevaluate_success(entry: dict, family: str) -> Optional[dict]:
    """
    Re-evaluate attack success using MLflow knowledge.
    Called when CRS classified the family but response_heuristics said failure.

    Returns {"success": True, "evidence": "..."} or None (keep original).
    """
    (method, url, path, path_clean, query, body, headers,
     status, resp_body, resp_headers, decoded_path) = _parse_request(entry)

    checker = _SUCCESS_REEVAL.get(family)
    if checker:
        return checker(method, path, path_clean, body, headers,
                       status, resp_body, resp_headers, decoded_path)
    return None


# --- Path Traversal Detection (CVE-2024-37059) -------------------------------

# MLflow artifact endpoints vulnerable to path traversal
_ARTIFACT_ENDPOINTS = (
    "/get-artifact",
    "/model-versions/get-artifact",
    "/ajax-api/2.0/mlflow/artifacts/list",
    "/api/2.0/mlflow/artifacts/list",
    "/ajax-api/2.0/mlflow-artifacts/artifacts",
    "/api/2.0/mlflow-artifacts/artifacts",
    "/ajax-api/2.0/mlflow/upload-artifact",
    "/api/2.0/mlflow/upload-artifact",
)

# File content signatures indicating successful path traversal
_SENSITIVE_FILE_PATTERNS = re.compile(
    r'(?:root:|daemon:|nobody:|/bin/(?:bash|sh)|/etc/(?:passwd|shadow|hosts|crontab)|'
    r'(?:ssh-rsa|ssh-ed25519)\s|BEGIN\s+(?:RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY|'
    r'\[(?:Unit|Service|Install)\]|'  # systemd unit files
    r'PRETTY_NAME=|ID=|VERSION_ID=)',  # os-release
    re.IGNORECASE
)


def _detect_path_traversal(method, url, path, path_clean, query, body, headers,
                           status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect path traversal attacks via MLflow artifact endpoints."""
    rules = []
    success = False
    evidence = ""

    # Decode the full path + query for traversal detection
    full_path = path
    try:
        decoded_full = unquote(unquote(full_path))
    except Exception:
        decoded_full = full_path

    is_artifact_ep = any(path_clean.startswith(ep) or path_clean == ep
                         for ep in _ARTIFACT_ENDPOINTS)

    # Pattern 1: GET on artifact endpoints with traversal in query params
    if method == "GET" and is_artifact_ep:
        # Check query string and full decoded path for traversal
        if _has_traversal_sequences(query) or _has_traversal_sequences(decoded_full):
            rules.append("ml-pt-artifact-traversal")

            if status == 200:
                # Check if actual file content was returned (not an error or API response)
                if _SENSITIVE_FILE_PATTERNS.search(resp_body):
                    success = True
                    evidence = "Path traversal: sensitive file content returned via artifact endpoint"
                elif (resp_body.strip()
                      and not resp_body.strip().startswith("{")
                      and "INVALID_PARAMETER_VALUE" not in resp_body
                      and "RESOURCE_DOES_NOT_EXIST" not in resp_body
                      and len(resp_body.strip()) > 20):
                    # Non-JSON, non-error content -- likely raw file content
                    success = True
                    evidence = "Path traversal: non-API content returned from artifact endpoint"
                else:
                    evidence = f"Path traversal attempt on artifact endpoint (200 but no file content)"
            elif status == 400:
                resp_lower = resp_body.lower()
                if "invalid path" in resp_lower or "invalid_parameter_value" in resp_lower:
                    evidence = "Path traversal blocked: server validated path"
                else:
                    evidence = f"Path traversal attempt on artifact endpoint (status 400)"
            elif status == 404:
                evidence = "Path traversal attempt: target file not found (404)"
            elif status == 500:
                # Server error could indicate partial traversal success
                evidence = "Path traversal attempt: server error (500) -- possible partial success"
            else:
                evidence = f"Path traversal attempt on artifact endpoint (status {status})"

            return _label("path_traversal", rules, success, evidence)

    # Pattern 2: POST upload-artifact with traversal in path param
    if method == "POST" and any(ep in path_clean for ep in ("upload-artifact",)):
        if _has_traversal_sequences(query) or _has_traversal_sequences(body):
            rules.append("ml-pt-upload-traversal")
            success = status == 200
            evidence = ("Path traversal via artifact upload"
                        + (" -- file written" if success else f" -- status {status}"))
            return _label("path_traversal", rules, success, evidence)

    # Pattern 3: Generic traversal sequences on any MLflow endpoint
    if _is_mlflow_api_path(path_clean) or is_artifact_ep:
        if _has_traversal_sequences(decoded_full) and not rules:
            rules.append("ml-pt-generic-traversal")
            if status == 200 and _SENSITIVE_FILE_PATTERNS.search(resp_body):
                success = True
                evidence = "Path traversal: sensitive file content in response"
            else:
                evidence = f"Path traversal attempt on MLflow endpoint (status {status})"
            return _label("path_traversal", rules, success, evidence)

    return None


# --- SSRF Detection (CVE-2024-37060) -----------------------------------------

# Dangerous URI schemes for SSRF
_SSRF_SCHEMES = re.compile(
    r'(?:file://|gopher://|dict://|ftp://|ldap://|tftp://)',
    re.IGNORECASE
)


def _detect_ssrf(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect SSRF attacks via MLflow artifact_location and source parameters."""
    if method != "POST":
        return None

    rules = []
    success = False
    evidence = ""

    body_json = _parse_json_body(body)
    body_lower = body.lower()

    # Pattern 1: experiments/create with malicious artifact_location
    if any(ep in path_clean for ep in ("experiments/create",)):
        artifact_loc = str(body_json.get("artifact_location", ""))
        if not artifact_loc:
            # Try to extract from raw body
            m = re.search(r'"artifact_location"\s*:\s*"([^"]*)"', body)
            artifact_loc = m.group(1) if m else ""

        if artifact_loc:
            is_ssrf = False
            ssrf_indicators = []

            if _SSRF_TARGETS.search(artifact_loc):
                is_ssrf = True
                ssrf_indicators.append("internal-ip-target")
            if _SSRF_SCHEMES.search(artifact_loc):
                is_ssrf = True
                ssrf_indicators.append("dangerous-scheme")
            if re.match(r'https?://', artifact_loc, re.IGNORECASE):
                try:
                    parsed = urlparse(artifact_loc)
                    host = (parsed.hostname or "").lower()
                    if host and host not in _INTERNAL_HOSTS:
                        # External URL as artifact_location -- could be SSRF
                        # but only flag if it looks intentionally malicious
                        if any(kw in artifact_loc.lower() for kw in
                               ("meta-data", "metadata", "latest", "admin",
                                "internal", "secret", "credential", "token")):
                            is_ssrf = True
                            ssrf_indicators.append("suspicious-external-target")
                    else:
                        is_ssrf = True
                        ssrf_indicators.append("internal-host-target")
                except Exception:
                    pass

            if is_ssrf:
                rules.append("ml-ssrf-artifact-location")
                for ind in ssrf_indicators:
                    rules.append(f"ml-ssrf-{ind}")

                if status == 200:
                    resp_lower = resp_body.lower()
                    if '"experiment_id"' in resp_lower or '"experiment"' in resp_lower:
                        success = True
                        evidence = (f"SSRF: experiment created with malicious "
                                    f"artifact_location={artifact_loc[:80]}")
                    else:
                        success = True
                        evidence = (f"SSRF: artifact_location accepted "
                                    f"(200 response, location={artifact_loc[:80]})")
                elif status in (400, 404):
                    evidence = (f"SSRF attempt via artifact_location rejected "
                                f"(status {status})")
                else:
                    evidence = (f"SSRF attempt via artifact_location "
                                f"(status {status}, location={artifact_loc[:80]})")

                return _label("ssrf", rules, success, evidence)

    # Pattern 2: model-versions/create with malicious source
    if any(ep in path_clean for ep in ("model-versions/create",)):
        source = str(body_json.get("source", ""))
        if not source:
            m = re.search(r'"source"\s*:\s*"([^"]*)"', body)
            source = m.group(1) if m else ""

        if source:
            is_ssrf = False
            ssrf_indicators = []

            if _SSRF_TARGETS.search(source):
                is_ssrf = True
                ssrf_indicators.append("internal-ip-target")
            if _SSRF_SCHEMES.search(source):
                is_ssrf = True
                ssrf_indicators.append("dangerous-scheme")

            if is_ssrf:
                rules.append("ml-ssrf-model-version-source")
                for ind in ssrf_indicators:
                    rules.append(f"ml-ssrf-{ind}")

                if status == 200:
                    success = True
                    evidence = (f"SSRF: model version created with malicious "
                                f"source={source[:80]}")
                else:
                    evidence = (f"SSRF attempt via model-version source "
                                f"(status {status}, source={source[:80]})")

                return _label("ssrf", rules, success, evidence)

    # Pattern 3: Any MLflow POST with file:// or internal targets in body
    if _is_mlflow_api_path(path_clean):
        if ("file://" in body_lower or "gopher://" in body_lower or "dict://" in body_lower):
            if "artifact_location" in body_lower or "source" in body_lower or "uri" in body_lower:
                rules.append("ml-ssrf-generic-scheme")
                success = status == 200
                evidence = ("SSRF: dangerous URI scheme in MLflow API request"
                            + (" -- accepted" if success else f" -- status {status}"))
                return _label("ssrf", rules, success, evidence)

    return None


# --- RCE / Command Injection Detection (CVE-2024-27132) ----------------------

# Patterns indicating malicious payloads in experiment/run names
_RCE_PAYLOAD_PATTERNS = re.compile(
    r'(?:'
    r'<script[^>]*>|'                          # XSS/JS execution in rendering
    r'javascript\s*:|'                          # JS URI scheme
    r'on(?:load|error|click|mouseover)\s*=|'    # Event handlers
    r'\{\{.*?\}\}|'                             # Template injection (Jinja2, etc.)
    r'\$\{.*?\}|'                               # Expression language injection
    r'__import__|'                               # Python code injection
    r'eval\s*\(|exec\s*\(|'                     # Direct code execution
    r'os\.(?:system|popen)|'                     # OS command execution
    r'subprocess\.|'                             # Python subprocess
    r'Runtime\.getRuntime|'                      # Java RCE
    r'ProcessBuilder|'                           # Java process execution
    r';\s*(?:cat|ls|id|whoami|curl|wget|nc)\s|'  # Shell command chaining
    r'\|\s*(?:bash|sh|zsh|cmd)\s|'              # Pipe to shell
    r'`[^`]+`|'                                  # Backtick command substitution
    r'\$\([^)]+\)'                               # $() command substitution
    r')',
    re.IGNORECASE
)

# Serialized/pickle payload indicators
_SERIALIZATION_PATTERNS = re.compile(
    r'(?:'
    r'\\x80\\x|'                    # Python pickle header
    r'gASV|'                         # Base64 pickle header
    r'cos\nsystem|'                  # Pickle os.system
    r'cposix\nsystem|'              # Pickle posix.system
    r'c__builtin__|'                # Pickle builtins
    r'\\x89HDF|'                     # HDF5 header (potential deserialization)
    r'rO0ABX|'                       # Java serialized (base64)
    r'aced0005|'                     # Java serialized (hex)
    r'O:[\d]+:"|'                    # PHP serialized object
    r'yaml\.(?:unsafe_load|full_load)|'  # Unsafe YAML loading
    r'!!python/object|'             # YAML Python object tag
    r'!!python/object/apply|'       # YAML Python apply tag
    r'tag:yaml\.org,\d+:python'     # YAML Python tag
    r')',
    re.IGNORECASE
)


def _detect_cmdi(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect RCE/command injection via MLflow experiment and run names."""
    if method != "POST":
        return None

    rules = []
    success = False
    evidence = ""

    body_json = _parse_json_body(body)

    # Pattern 1: experiments/create with malicious name
    if any(ep in path_clean for ep in ("experiments/create",)):
        name = str(body_json.get("name", ""))
        if not name:
            m = re.search(r'"name"\s*:\s*"([^"]*)"', body)
            name = m.group(1) if m else ""

        if name and _RCE_PAYLOAD_PATTERNS.search(name):
            rules.append("ml-rce-experiment-name")
            # Storing a malicious name is NOT confirmed execution.
            # CVE-2024-27132 triggers on rendering, not creation.
            # Only mark success if response shows execution evidence.
            if status == 200:
                resp_lower = resp_body.lower()
                if any(kw in resp_lower for kw in ["uid=", "root:", "linux", "whoami", "id="]):
                    success = True
                    evidence = (f"RCE: experiment name payload executed "
                                f"(CVE-2024-27132)")
                else:
                    success = False
                    evidence = (f"RCE: malicious experiment name stored but "
                                f"no execution evidence (CVE-2024-27132)")
            else:
                evidence = (f"RCE attempt via experiment name "
                            f"(status {status})")
            return _label("cmdi", rules, success, evidence)

    # Pattern 2: runs/create or runs/update with malicious run_name
    if any(ep in path_clean for ep in ("runs/create", "runs/update")):
        run_name = str(body_json.get("run_name", ""))
        if not run_name:
            m = re.search(r'"run_name"\s*:\s*"([^"]*)"', body)
            run_name = m.group(1) if m else ""

        # Also check tags for malicious content
        tags = body_json.get("tags", [])
        tag_values = " ".join(str(t.get("value", "")) for t in tags if isinstance(t, dict))

        check_text = run_name + " " + tag_values
        if check_text.strip() and _RCE_PAYLOAD_PATTERNS.search(check_text):
            rules.append("ml-rce-run-name")
            if status == 200:
                resp_lower = resp_body.lower()
                if any(kw in resp_lower for kw in ["uid=", "root:", "linux", "whoami", "id="]):
                    success = True
                    evidence = "RCE: run name payload executed (CVE-2024-27132)"
                else:
                    success = False
                    evidence = "RCE: malicious run name stored but no execution evidence (CVE-2024-27132)"
            else:
                evidence = f"RCE attempt via run name/tags (status {status})"
            return _label("cmdi", rules, success, evidence)

    # Pattern 3: model-versions/create or registered-models/create with malicious data
    if any(ep in path_clean for ep in ("registered-models/create",
                                        "model-versions/create")):
        name = str(body_json.get("name", ""))
        description = str(body_json.get("description", ""))
        check_text = name + " " + description
        if check_text.strip() and _RCE_PAYLOAD_PATTERNS.search(check_text):
            rules.append("ml-rce-model-name")
            if status == 200:
                resp_lower = resp_body.lower()
                if any(kw in resp_lower for kw in ["uid=", "root:", "linux", "whoami", "id="]):
                    success = True
                    evidence = "RCE: model name payload executed"
                else:
                    success = False
                    evidence = "RCE: malicious model name stored but no execution evidence"
            else:
                evidence = f"RCE attempt via model name/description (status {status})"
            return _label("cmdi", rules, success, evidence)

    # Pattern 4: Serialized/pickle payload in artifact upload body
    if any(ep in path_clean for ep in ("upload-artifact",)):
        if _SERIALIZATION_PATTERNS.search(body):
            rules.append("ml-rce-pickle-upload")
            family = "deserialization"
            if status == 200:
                success = True
                evidence = "Deserialization: serialized payload uploaded as artifact"
            else:
                evidence = f"Deserialization attempt via artifact upload (status {status})"
            return _label(family, rules, success, evidence)

    # Pattern 5: runs/set-tag with malicious tag values
    if any(ep in path_clean for ep in ("runs/set-tag", "runs/log-parameter")):
        value = str(body_json.get("value", ""))
        key = str(body_json.get("key", ""))
        check_text = key + " " + value
        if check_text.strip() and _RCE_PAYLOAD_PATTERNS.search(check_text):
            rules.append("ml-rce-tag-value")
            if status == 200:
                success = True
                evidence = "RCE: malicious payload stored via run tag/parameter"
            else:
                evidence = f"RCE attempt via run tag/parameter (status {status})"
            return _label("cmdi", rules, success, evidence)

    # Pattern 6: Any MLflow POST with serialization patterns in body
    if _is_mlflow_api_path(path_clean) and _SERIALIZATION_PATTERNS.search(body):
        rules.append("ml-rce-serialized-payload")
        family = "deserialization"
        if status == 200:
            success = True
            evidence = "Deserialization: serialized payload accepted by MLflow API"
        else:
            evidence = f"Deserialization attempt on MLflow API (status {status})"
        return _label(family, rules, success, evidence)

    return None


# --- SQL Injection Detection -------------------------------------------------

# SQLi patterns specific to MLflow's filter syntax
_SQLI_FILTER_PATTERNS = re.compile(
    r'(?:'
    r"'\s*(?:OR|AND)\s+\d+\s*=\s*\d+|"       # ' OR 1=1
    r"'\s*(?:OR|AND)\s+'[^']*'\s*=\s*'|"      # ' OR 'a'='a
    r";\s*(?:DROP|DELETE|UPDATE|INSERT|ALTER)\s|"  # Stacked queries
    r"UNION\s+(?:ALL\s+)?SELECT|"              # UNION SELECT
    r"'\s*--\s*$|"                              # Comment termination
    r"'\s*#\s*$|"                               # MySQL comment
    r"SLEEP\s*\(|BENCHMARK\s*\(|"              # Time-based blind
    r"WAITFOR\s+DELAY|"                         # MSSQL time-based
    r"(?:EXTRACTVALUE|UPDATEXML)\s*\(|"         # Error-based
    r"LOAD_FILE\s*\(|INTO\s+(?:OUTFILE|DUMPFILE)" # File operations
    r")",
    re.IGNORECASE
)


def _detect_sqli(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect SQL injection via MLflow search/filter endpoints."""
    rules = []
    success = False
    evidence = ""

    body_json = _parse_json_body(body)

    # Pattern 1: experiments/search or runs/search with malicious filter
    is_search_ep = any(ep in path_clean for ep in
                       ("experiments/search", "runs/search",
                        "registered-models/search", "model-versions/search"))

    if is_search_ep:
        filter_str = str(body_json.get("filter", ""))
        if not filter_str:
            filter_str = str(body_json.get("filter_string", ""))
        if not filter_str and method == "GET":
            # Check query string for filter parameter
            filter_match = re.search(r'filter=([^&]*)', query, re.IGNORECASE)
            filter_str = unquote(filter_match.group(1)) if filter_match else ""

        if filter_str and _SQLI_FILTER_PATTERNS.search(filter_str):
            rules.append("ml-sqli-search-filter")

            if status == 500:
                # SQL error in response suggests injection reached the DB
                resp_lower = resp_body.lower()
                if any(kw in resp_lower for kw in
                       ("sql", "syntax error", "sqlite", "operationalerror",
                        "programmingerror", "integrity", "database")):
                    success = True
                    evidence = "SQLi: database error returned (error-based injection)"
                else:
                    evidence = "SQLi attempt: server error (500) on search filter"
            elif status == 200:
                # Successful query -- could be blind injection or data exfil
                resp_lower = resp_body.lower()
                if '"experiments"' in resp_lower or '"runs"' in resp_lower:
                    # Check if response has unexpectedly many results
                    success = True
                    evidence = "SQLi: search filter accepted with injection payload"
                else:
                    evidence = f"SQLi attempt on search filter (200 response)"
            elif status == 400:
                resp_lower = resp_body.lower()
                if any(kw in resp_lower for kw in
                       ("syntax", "sql", "parse", "invalid")):
                    evidence = "SQLi attempt: filter syntax rejected (400)"
                else:
                    evidence = f"SQLi attempt on search filter (status 400)"
            else:
                evidence = f"SQLi attempt on search filter (status {status})"

            return _label("sqli", rules, success, evidence)

    # Pattern 2: SQLi in query parameters of any MLflow GET endpoint
    if method == "GET" and _is_mlflow_api_path(path_clean):
        decoded_query = query
        try:
            decoded_query = unquote(unquote(query))
        except Exception:
            pass

        if decoded_query and _SQLI_FILTER_PATTERNS.search(decoded_query):
            rules.append("ml-sqli-query-param")
            if status == 500:
                success = True
                evidence = "SQLi: database error via query parameter injection"
            else:
                evidence = f"SQLi attempt in query parameters (status {status})"
            return _label("sqli", rules, success, evidence)

    return None


# --- Information Disclosure Detection ----------------------------------------

# MLflow endpoints that expose sensitive information. /health, /version, and
# /static-files are public by design and excluded.
_INFO_ENDPOINTS = {
    "/api/2.0/mlflow/experiments/search":
                      ("ml-info-experiments", "Experiments listing"),
    "/ajax-api/2.0/mlflow/experiments/search":
                      ("ml-info-experiments", "Experiments listing"),
    "/api/2.0/mlflow/experiments/list":
                      ("ml-info-experiments", "Experiments listing"),
    "/ajax-api/2.0/mlflow/experiments/list":
                      ("ml-info-experiments", "Experiments listing"),
    "/api/2.0/mlflow/registered-models/search":
                      ("ml-info-models",     "Registered models listing"),
    "/ajax-api/2.0/mlflow/registered-models/search":
                      ("ml-info-models",     "Registered models listing"),
}


def _detect_info_disclosure(method, url, path, path_clean, query, body, headers,
                            status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect information disclosure via MLflow endpoints."""
    if method != "GET":
        return None

    rules = []
    success = False
    evidence = ""

    # Check known sensitive endpoints
    for ep, (rule, desc) in _INFO_ENDPOINTS.items():
        if path_clean == ep or path_clean.startswith(ep + "/"):
            rules.append(rule)

            if status == 200:
                resp_lower = resp_body.lower()

                # Version endpoint
                if "version" in ep:
                    if resp_body.strip() and len(resp_body.strip()) < 200:
                        success = True
                        evidence = f"{desc} -- version exposed: {resp_body.strip()[:50]}"
                    else:
                        evidence = f"{desc} -- empty or unexpected response"
                # Experiments/models listing
                elif "experiments" in ep or "models" in ep:
                    if ('"experiments"' in resp_lower or '"experiment"' in resp_lower
                            or '"registered_models"' in resp_lower):
                        success = True
                        evidence = f"{desc} -- data returned"
                    else:
                        evidence = f"{desc} -- no data in response"
                # Static files
                elif "static" in ep:
                    if len(resp_body) > 50:
                        success = True
                        evidence = f"{desc} -- content returned"
                    else:
                        evidence = f"{desc} -- limited content"
                # Health
                elif "health" in ep:
                    success = True
                    evidence = f"{desc} -- service health exposed"
                else:
                    success = len(resp_body) > 50
                    evidence = f"{desc}" + (" -- content exposed" if success else " -- limited content")
            else:
                evidence = f"{desc} -- access denied (status {status})"

            return _label("info_disclosure", rules, success, evidence)

    # Error response with stack trace / framework info
    if isinstance(status, int) and status >= 400:
        if re.search(r'(?:Traceback\s*\(most\s+recent|'
                     r'File\s+"[^"]+",\s+line\s+\d+|'
                     r'(?:mlflow|flask|werkzeug|gunicorn)\.\w+\.\w+|'
                     r'sqlalchemy\.exc\.\w+Error|'
                     r'OperationalError|ProgrammingError|'
                     r'Internal\s+Server\s+Error)',
                     resp_body, re.IGNORECASE):
            rules.append("ml-info-error-stack-trace")
            success = True
            evidence = "Error response leaks stack trace / framework details"
            return _label("info_disclosure", rules, success, evidence)

    # Artifact listing that reveals directory structure
    if method == "GET" and any(ep in path_clean for ep in
                                ("artifacts/list", "mlflow-artifacts/artifacts")):
        if status == 200 and '"files"' in resp_body.lower():
            # Only flag if this is the root listing (no specific artifact path)
            if not query or "path=" not in query or query.endswith("path=") or query.endswith("path=/"):
                rules.append("ml-info-artifact-listing")
                success = True
                evidence = "Artifact directory listing exposed"
                return _label("info_disclosure", rules, success, evidence)

    return None


# --- File Upload Detection ---------------------------------------------------

def _detect_file_upload(method, url, path, path_clean, query, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect malicious file upload via MLflow artifact upload."""
    if method != "POST":
        return None

    # Only target artifact upload endpoints
    is_upload_ep = any(ep in path_clean for ep in
                       ("upload-artifact", "mlflow-artifacts/artifacts"))
    if not is_upload_ep:
        return None

    content_type = str(headers.get("Content-Type", headers.get("content-type", "")))
    body_lower = body.lower()
    rules = []
    success = False
    evidence = ""

    # Check for dangerous file content in upload
    if _SERIALIZATION_PATTERNS.search(body):
        # Serialized payloads are handled by _detect_cmdi
        return None

    # Dangerous file extensions in query path parameter
    path_param = ""
    path_match = re.search(r'path=([^&]*)', query, re.IGNORECASE)
    if path_match:
        path_param = unquote(path_match.group(1))

    # Check for webshell / script upload
    if re.search(r'\.(?:py|sh|bash|php|jsp|aspx?|rb|pl|cgi|exe|bat|cmd)$',
                 path_param, re.IGNORECASE):
        rules.append("ml-upload-executable")
        if status == 200:
            success = True
            evidence = f"Executable file uploaded as artifact: {path_param}"
        else:
            evidence = f"Executable upload attempt (status {status}): {path_param}"

    # Check for XML upload (potential XXE)
    elif "<?xml" in body_lower or path_param.endswith(".xml"):
        if "<!entity" in body_lower or "<!doctype" in body_lower:
            rules.append("ml-upload-xxe")
            if status == 200:
                if any(kw in resp_body for kw in ["root:", "ENTITY", "/etc/"]):
                    success = True
                    evidence = "XXE: sensitive data leaked via XML artifact upload"
                else:
                    success = True
                    evidence = "XXE: XML artifact with entity declaration uploaded"
            else:
                evidence = f"XXE attempt via XML artifact upload (status {status})"
        else:
            return None  # Benign XML upload

    # Check for YAML with unsafe load indicators
    elif path_param.endswith((".yml", ".yaml")):
        if "!!python" in body_lower or "!!map" in body_lower:
            rules.append("ml-upload-yaml-rce")
            if status == 200:
                success = True
                evidence = "YAML with Python tags uploaded as artifact"
            else:
                evidence = f"YAML RCE attempt via artifact upload (status {status})"
        else:
            return None  # Benign YAML upload

    # Generic large upload to artifact endpoint (only flag if there is a
    # suspicious aspect -- avoid flagging benign model file uploads)
    else:
        return None

    if rules:
        return _label("file_upload", rules, success, evidence)
    return None


# --- Success re-evaluation functions (per family) ----------------------------

def _reeval_path_traversal(method, path, path_clean, body, headers,
                           status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate path traversal success with MLflow knowledge."""
    if status != 200:
        return None

    # Check if response contains actual file content from traversal
    is_artifact_ep = any(ep in path_clean for ep in
                         ("get-artifact", "artifacts/list", "mlflow-artifacts"))

    if is_artifact_ep or _has_traversal_sequences(decoded_path):
        # Sensitive file content
        if _SENSITIVE_FILE_PATTERNS.search(resp_body):
            return {"success": True,
                    "evidence": "Path traversal: sensitive file content returned"}

        # Non-JSON, non-error raw content (likely file content)
        stripped = resp_body.strip()
        if (stripped
                and not stripped.startswith("{")
                and not stripped.startswith("[")
                and "INVALID_PARAMETER_VALUE" not in resp_body
                and "RESOURCE_DOES_NOT_EXIST" not in resp_body
                and "<!DOCTYPE" not in resp_body[:100]
                and len(stripped) > 20):
            return {"success": True,
                    "evidence": "Path traversal: raw file content returned via artifact endpoint"}

    return None


def _reeval_ssrf(method, path, path_clean, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate SSRF success with MLflow knowledge."""
    if status != 200:
        return None

    body_lower = body.lower()

    # SSRF via artifact_location -- if experiment was created, SSRF succeeded
    if any(ep in path_clean for ep in ("experiments/create",)):
        if "artifact_location" in body_lower:
            artifact_loc = ""
            try:
                body_json = _parse_json_body(body)
                artifact_loc = str(body_json.get("artifact_location", ""))
            except Exception:
                pass
            if artifact_loc and (_SSRF_TARGETS.search(artifact_loc)
                                 or _SSRF_SCHEMES.search(artifact_loc)):
                resp_lower = resp_body.lower()
                if '"experiment_id"' in resp_lower:
                    return {"success": True,
                            "evidence": (f"SSRF: experiment created with "
                                         f"artifact_location={artifact_loc[:80]}")}

    # SSRF via model-version source
    if any(ep in path_clean for ep in ("model-versions/create",)):
        if "source" in body_lower:
            source = ""
            try:
                body_json = _parse_json_body(body)
                source = str(body_json.get("source", ""))
            except Exception:
                pass
            if source and (_SSRF_TARGETS.search(source)
                           or _SSRF_SCHEMES.search(source)):
                return {"success": True,
                        "evidence": (f"SSRF: model version created with "
                                     f"source={source[:80]}")}

    # Get-artifact after SSRF setup -- if content from internal target returned
    if any(ep in path_clean for ep in ("get-artifact", "mlflow-artifacts")):
        # Check if response contains data from typical SSRF targets
        if re.search(r'(?:ami-[0-9a-f]+|instance-id|security-credentials|'
                     r'iam/|meta-data/|root:|/bin/bash)',
                     resp_body, re.IGNORECASE):
            return {"success": True,
                    "evidence": "SSRF: internal/metadata content in artifact response"}

    return None


def _reeval_cmdi(method, path, path_clean, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate RCE/command injection success with MLflow knowledge.

    Storing a malicious name is NOT confirmed execution.
    Only mark success if response contains execution evidence
    (e.g., uid=, command output, etc.)
    """
    if status != 200:
        return None

    resp_lower = resp_body.lower()
    has_exec_evidence = any(kw in resp_lower for kw in
                            ["uid=", "root:", "linux", "whoami", "id="])

    if not has_exec_evidence:
        return None

    # RCE via experiment/run name - only if execution evidence in response
    if any(ep in path_clean for ep in ("experiments/create",)):
        body_json = _parse_json_body(body)
        name = str(body_json.get("name", ""))
        if name and _RCE_PAYLOAD_PATTERNS.search(name):
            return {"success": True,
                    "evidence": "RCE: experiment name payload executed (CVE-2024-27132)"}

    if any(ep in path_clean for ep in ("runs/create",)):
        body_json = _parse_json_body(body)
        run_name = str(body_json.get("run_name", ""))
        if run_name and _RCE_PAYLOAD_PATTERNS.search(run_name):
            return {"success": True,
                    "evidence": "RCE: run name payload executed (CVE-2024-27132)"}

    return None


def _reeval_sqli(method, path, path_clean, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate SQLi success with MLflow knowledge."""
    is_search_ep = any(ep in path_clean for ep in
                       ("experiments/search", "runs/search",
                        "registered-models/search", "model-versions/search"))

    if not is_search_ep:
        return None

    # 200 with data when filter had injection
    if status == 200:
        body_json = _parse_json_body(body)
        filter_str = str(body_json.get("filter", body_json.get("filter_string", "")))
        if filter_str and _SQLI_FILTER_PATTERNS.search(filter_str):
            resp_lower = resp_body.lower()
            if ('"experiments"' in resp_lower or '"runs"' in resp_lower
                    or '"registered_models"' in resp_lower):
                return {"success": True,
                        "evidence": "SQLi: search returned data with injection payload"}

    # 500 with SQL error message
    if status == 500:
        resp_lower = resp_body.lower()
        if any(kw in resp_lower for kw in
               ("sql", "syntax error", "sqlite", "operationalerror",
                "programmingerror", "database")):
            return {"success": True,
                    "evidence": "SQLi: database error in response (error-based injection)"}

    return None


def _reeval_info_disclosure(method, path, path_clean, body, headers,
                            status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate info disclosure success with MLflow knowledge."""
    if status != 200:
        return None

    # Stack trace in error response
    if re.search(r'(?:Traceback|File\s+"[^"]+",\s+line|'
                 r'mlflow\.\w+|flask\.\w+|werkzeug\.\w+)',
                 resp_body, re.IGNORECASE):
        return {"success": True,
                "evidence": "Stack trace / framework details exposed in response"}

    # Version info
    if path_clean.endswith("/version"):
        if resp_body.strip() and len(resp_body.strip()) < 200:
            return {"success": True,
                    "evidence": f"MLflow version exposed: {resp_body.strip()[:50]}"}

    return None


def _reeval_file_upload(method, path, path_clean, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate file upload success with MLflow knowledge."""
    if method != "POST" or status not in (200, 201, 204):
        return None

    body_lower = body.lower()

    # XXE success
    if "<?xml" in body_lower or "<!entity" in body_lower:
        if any(kw in resp_body for kw in ["root:", "/etc/", "ENTITY"]):
            return {"success": True, "evidence": "XXE: sensitive data in response"}
        if status == 200 and len(resp_body) > 50:
            return {"success": True, "evidence": "XXE: XML artifact processed"}

    # Executable upload accepted
    query = path.split("?", 1)[1] if "?" in path else ""
    path_match = re.search(r'path=([^&]*)', query, re.IGNORECASE)
    if path_match:
        path_param = unquote(path_match.group(1))
        if re.search(r'\.(?:py|sh|bash|php|jsp|aspx?|rb|pl|cgi|exe|bat|cmd)$',
                     path_param, re.IGNORECASE):
            return {"success": True,
                    "evidence": f"Executable artifact uploaded: {path_param}"}

    return None


def _reeval_deserialization(method, path, path_clean, body, headers,
                            status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate deserialization success with MLflow knowledge."""
    if status != 200:
        return None

    if _SERIALIZATION_PATTERNS.search(body):
        # If MLflow accepted the serialized content, the payload is stored
        if any(ep in path_clean for ep in ("upload-artifact", "mlflow-artifacts")):
            return {"success": True,
                    "evidence": "Deserialization: serialized payload stored as artifact"}

    return None


# Mapping family -> re-evaluation function
_SUCCESS_REEVAL = {
    "path_traversal": _reeval_path_traversal,
    "ssrf": _reeval_ssrf,
    "cmdi": _reeval_cmdi,
    "sqli": _reeval_sqli,
    "info_disclosure": _reeval_info_disclosure,
    "file_upload": _reeval_file_upload,
    "deserialization": _reeval_deserialization,
}
