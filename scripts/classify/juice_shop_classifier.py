#!/usr/bin/env python3
"""
Juice Shop Endpoint-Aware Attack Classifier
=============================================
Supplements CRS pattern matching for OWASP Juice Shop.
Classifies business-logic attacks that CRS regex patterns miss
(CSRF, IDOR, file upload, info disclosure, auth bypass, etc.)
and provides application-aware success detection.

Two entry points:
  1. classify_request(entry) -> fallback for CRS "others" classification
  2. reevaluate_success(entry, family) -> re-check success for CRS-classified entries

Works for victim_type="juice-shop" only. Other victims use CRS-only pipeline.
"""
import base64
import json
import re
from urllib.parse import unquote, urlparse
from typing import Optional


# Juice Shop known domains (used to detect external Origin/Referer)
_INTERNAL_HOSTS = frozenset({
    "juice-sh.op", "localhost", "127.0.0.1", "0.0.0.0",
    "victim", "juiceshop", "juice-shop",
})

# CAPEC / CWE mappings for families
_CAPEC = {
    "csrf": "CAPEC-62", "idor": "CAPEC-1", "file_upload": "CAPEC-17",
    "info_disclosure": "CAPEC-118", "auth_bypass": "CAPEC-115",
    "path_traversal": "CAPEC-126", "ssrf": "CAPEC-664", "cmdi": "CAPEC-88",
    "xss": "CAPEC-86", "sqli": "CAPEC-66",
}
_CWE = {
    "csrf": "CWE-352", "idor": "CWE-639", "file_upload": "CWE-434",
    "info_disclosure": "CWE-200", "auth_bypass": "CWE-287",
    "path_traversal": "CWE-22", "ssrf": "CWE-918", "cmdi": "CWE-78",
    "xss": "CWE-79", "sqli": "CWE-89",
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


def _has_external_origin(headers: dict) -> tuple[bool, str]:
    """Check if request has Origin/Referer from external domain.
    Returns (is_external, origin_value)."""
    for hdr in ("Origin", "origin", "Referer", "referer"):
        val = str(headers.get(hdr, ""))
        if not val:
            continue
        try:
            host = urlparse(val).hostname or ""
            if host and host.lower() not in _INTERNAL_HOSTS:
                return True, val
        except Exception:
            pass
    return False, ""


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


# --- Main classify_request - fallback when CRS returns "others" --------------

def classify_request(entry: dict) -> Optional[dict]:
    """
    Classify an HTTP request using Juice Shop endpoint knowledge.
    Called when CRS pattern matching returns family="others".

    Returns attack_label dict (with success already evaluated) or None.
    """
    (method, url, path, path_clean, query, body, headers,
     status, resp_body, resp_headers, decoded_path) = _parse_request(entry)

    # Try each detector in priority order
    for detector in (_detect_csrf, _detect_idor, _detect_file_upload,
                     _detect_info_disclosure, _detect_auth_bypass,
                     _detect_path_traversal, _detect_ssrf, _detect_cmdi):
        result = detector(method, url, path, path_clean, query, body,
                          headers, status, resp_body, resp_headers, decoded_path)
        if result is not None:
            return result

    return None


# --- reevaluate_success - second-chance success check for CRS-classified entries ---

def reevaluate_success(entry: dict, family: str) -> Optional[dict]:
    """
    Re-evaluate attack success using Juice Shop knowledge.
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


# --- CSRF Detection ----------------------------------------------------------

# Juice Shop state-changing endpoints vulnerable to CSRF
_CSRF_ENDPOINTS = {
    "/profile",                    # csrfChallenge — main target
    "/api/feedbacks",              # anonymous feedback
    "/api/complaints",
    "/api/cards",
    "/api/addresss",               # yes, Juice Shop misspells it
    "/api/recycles",
    "/rest/user/change-password",
    "/rest/products/reviews",      # PUT review
    "/api/basketitems",
    "/api/quantitys",
}


def _detect_csrf(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect CSRF attacks based on external Origin/Referer or CSRF test patterns."""
    if method not in ("POST", "PUT", "DELETE", "PATCH"):
        return None

    external, origin_val = _has_external_origin(headers)

    # Must have at least one CSRF indicator
    is_csrf_endpoint = any(path_clean == ep or path_clean.startswith(ep + "/")
                           for ep in _CSRF_ENDPOINTS)
    body_lower = (body + query).lower()
    has_csrf_keyword = any(kw in body_lower for kw in
                           ["csrf", "xsrf", "cross-site", "cross_site", "forgery"])

    if not external and not has_csrf_keyword:
        return None

    # Build rule list
    rules = []
    if external:
        rules.append("js-csrf-external-origin")
    if is_csrf_endpoint:
        rules.append("js-csrf-target-endpoint")
    if has_csrf_keyword:
        rules.append("js-csrf-keyword")

    if not rules:
        return None

    # Success evaluation
    success = False
    evidence = ""

    if status == 302:
        # Redirect after state change = success (e.g., POST /profile -> 302)
        success = True
        evidence = f"CSRF succeeded: external-origin state change accepted (302 redirect)"
    elif status in (200, 201):
        # Check if response indicates actual mutation
        resp_lower = resp_body.lower()
        if any(kw in resp_lower for kw in ['"status":"success"', '"id":', '"data":', "created", "updated"]):
            success = True
            evidence = f"CSRF succeeded: state change accepted (status {status})"
        elif status == 201:
            success = True
            evidence = f"CSRF succeeded: resource created (201)"
        elif is_csrf_endpoint and external:
            # External origin + known endpoint + 200 -> likely success
            success = True
            evidence = f"CSRF succeeded: external-origin request to {path_clean} accepted"
    elif status >= 400:
        evidence = f"CSRF failed: server rejected request (status {status})"
    else:
        evidence = f"CSRF attempt: status {status}"

    return _label("csrf", rules, success, evidence)


# --- IDOR Detection ----------------------------------------------------------

def _detect_idor(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect Insecure Direct Object Reference attacks."""
    rules = []
    success = False
    evidence = ""

    # Pattern 1: Accessing specific basket (GET /rest/basket/{id})
    m = re.search(r'/rest/basket/(\d+)', path_clean)
    if m and method == "GET":
        bid = m.group(1)
        rules.append("js-idor-basket")
        success = (status == 200 and
                   any(kw in resp_body for kw in ['"Products"', '"BasketItems"', '"items"', '"id"']))
        evidence = f"IDOR basket #{bid}" + (" — data exposed" if success else " — denied")
        return _label("idor", rules, success, evidence)

    # Pattern 2: Accessing specific user (GET /api/Users/{id})
    m = re.search(r'/api/users/(\d+)', path_clean)
    if m and method == "GET":
        uid = m.group(1)
        rules.append("js-idor-user")
        success = status == 200 and ('"email"' in resp_body or '"role"' in resp_body)
        evidence = f"IDOR user #{uid}" + (" — data exposed" if success else " — denied")
        return _label("idor", rules, success, evidence)

    # Pattern 3: Modifying user (PUT /api/Users/{id})
    m = re.search(r'/api/users/(\d+)', path_clean)
    if m and method == "PUT":
        uid = m.group(1)
        rules.append("js-idor-user-modify")
        success = status == 200
        evidence = f"IDOR user #{uid} modification" + (" — succeeded" if success else " — denied")
        return _label("idor", rules, success, evidence)

    # Pattern 4: Basket item manipulation (POST/PUT /api/BasketItems)
    if re.search(r'/api/basketitems', path_clean) and method in ("POST", "PUT"):
        if any(kw in body for kw in ['"BasketId"', '"basketId"', '"basket_id"']):
            rules.append("js-idor-basket-item")
            success = status in (200, 201)
            evidence = "IDOR basket item manipulation" + (" — succeeded" if success else " — failed")
            return _label("idor", rules, success, evidence)

    # Pattern 5: Data export for another user
    if "/rest/user/data-export" in path_clean and method == "POST":
        rules.append("js-idor-data-export")
        success = status == 200 and len(resp_body) > 100
        evidence = "IDOR data export" + (" — data returned" if success else " — failed")
        return _label("idor", rules, success, evidence)

    # Pattern 6: User listing (GET /api/Users - no specific ID)
    if path_clean == "/api/users" and method == "GET":
        rules.append("js-idor-user-listing")
        success = status == 200 and '"email"' in resp_body
        evidence = "User listing" + (" — all users exposed" if success else " — denied")
        return _label("idor", rules, success, evidence)

    # Pattern 7: Order history / deliveries / quantitys
    m = re.search(r'/api/(?:deliverys|quantitys|recycles)/(\d+)', path_clean)
    if m and method == "GET":
        rules.append("js-idor-resource-enum")
        success = status == 200
        evidence = f"IDOR resource enumeration" + (" — data returned" if success else " — denied")
        return _label("idor", rules, success, evidence)

    # Pattern 8: GET /rest/order-history with different user
    if "/rest/order-history" in path_clean and method == "GET":
        rules.append("js-idor-order-history")
        success = status == 200 and ('"Products"' in resp_body or '"orderId"' in resp_body
                                     or '"totalPrice"' in resp_body)
        evidence = "IDOR order history" + (" — data returned" if success else " — denied")
        return _label("idor", rules, success, evidence)

    return None


# --- File Upload Detection ---------------------------------------------------

def _detect_file_upload(method, url, path, path_clean, query, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect malicious file upload attacks."""
    if method != "POST":
        return None

    content_type = str(headers.get("Content-Type", headers.get("content-type", "")))
    is_upload_ep = any(ep in path_clean for ep in
                       ["/file-upload", "/profile/image", "/rest/memories"])
    is_multipart = "multipart" in content_type.lower()

    if not (is_upload_ep or is_multipart):
        return None

    body_lower = body.lower()
    rules = []
    success = False
    evidence = ""

    # XXE via XML upload
    if "<?xml" in body_lower or ('filename=' in body_lower and '.xml' in body_lower):
        rules.append("js-upload-xxe")
        if status == 200:
            if any(kw in resp_body for kw in ["root:", "ENTITY", "/etc/", "passwd"]):
                success = True
                evidence = "XXE: sensitive data leaked via XML upload"
            elif len(resp_body) > 50:
                success = True
                evidence = "XXE: XML file processed successfully"
        if not success:
            evidence = f"XXE attempt via XML upload (status {status})"

    # ZIP Slip
    elif 'filename=' in body_lower and '.zip' in body_lower:
        rules.append("js-upload-zipslip")
        success = status in (200, 204)
        evidence = "ZIP Slip" + (" — file processed" if success else f" — status {status}")

    # YAML Bomb
    elif 'filename=' in body_lower and ('.yml' in body_lower or '.yaml' in body_lower):
        rules.append("js-upload-yamlbomb")
        success = status == 200
        evidence = "YAML Bomb" + (" — file processed" if success else f" — status {status}")

    # Dangerous file extension (.php, .jsp, .sh, etc.)
    elif re.search(r'filename="[^"]*\.(?:php|phtml|jsp|asp|aspx|sh|py|rb|pl|cgi|exe|bat|cmd)',
                   body_lower):
        rules.append("js-upload-webshell")
        success = status == 200
        evidence = "Webshell upload" + (" — accepted" if success else f" — status {status}")

    # Generic upload to sensitive endpoint
    elif is_upload_ep:
        rules.append("js-upload-generic")
        # Check for upload size/type bypass challenges
        if status in (200, 201, 204):
            success = True
            evidence = f"File uploaded to {path_clean}"
        elif status == 500 and ("size" in resp_body.lower() or "type" in resp_body.lower()):
            evidence = f"File upload rejected (server-side validation)"
        else:
            evidence = f"File upload attempt (status {status})"

    if rules:
        return _label("file_upload", rules, success, evidence)
    return None


# --- Information Disclosure Detection ----------------------------------------

# Juice Shop sensitive endpoints
_INFO_ENDPOINTS = {
    "/ftp":                  ("js-info-ftp",              "FTP directory"),
    "/encryptionkeys":       ("js-info-encryption-keys",  "Encryption keys directory"),
    "/support/logs":         ("js-info-access-logs",      "Access logs"),
    "/metrics":              ("js-info-metrics",          "Prometheus metrics"),
    "/.well-known":          ("js-info-well-known",       ".well-known directory"),
    "/robots.txt":           ("js-info-robots",           "robots.txt"),
    "/security.txt":         ("js-info-security-txt",     "security.txt"),
    "/api/challenges":       ("js-info-challenges",       "Challenges API"),
    "/rest/admin/application-configuration": ("js-info-admin-config", "Admin configuration"),
    "/rest/languages":       ("js-info-languages",        "Language configuration"),
    "/snippets":             ("js-info-code-snippets",    "Code snippets"),
    "/assets/public/images/uploads": ("js-info-uploads", "Upload directory listing"),
}


def _detect_info_disclosure(method, url, path, path_clean, query, body, headers,
                            status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect information disclosure attacks."""
    if method != "GET":
        return None

    # Server errors are not disclosure
    if isinstance(status, int) and status >= 500:
        # UNLESS the error response itself leaks info (stack traces)
        if not re.search(r'(?:at\s+\w+\s+\(|Traceback|SequelizeDatabase|SQLITE_ERROR|TypeError)',
                         resp_body):
            return None

    rules = []
    success = False
    evidence = ""

    # Check known sensitive endpoints
    for ep, (rule, desc) in _INFO_ENDPOINTS.items():
        if path_clean == ep or path_clean.startswith(ep + "/") or path_clean.startswith(ep + "?"):
            rules.append(rule)
            if status == 200:
                # Validate that actual content was returned (not just SPA HTML)
                is_spa_html = ("<app-root" in resp_body or "<!doctype html>" in resp_body.lower()[:200])
                if is_spa_html and len(resp_body) < 5000:
                    evidence = f"{desc} — SPA shell returned (no real data)"
                    return _label("info_disclosure", rules, False, evidence)

                # Endpoint-specific content validation
                if ep == "/metrics":
                    success = "# HELP" in resp_body or "# TYPE" in resp_body or "http_request" in resp_body
                elif ep == "/robots.txt":
                    success = "disallow" in resp_body.lower() or "user-agent" in resp_body.lower()
                elif ep.startswith("/ftp"):
                    success = len(resp_body) > 10
                elif ep == "/encryptionkeys":
                    success = len(resp_body) > 10
                elif ep == "/support/logs":
                    success = len(resp_body) > 50
                elif ep.startswith("/.well-known"):
                    success = len(resp_body) > 20
                elif ep == "/rest/admin/application-configuration":
                    success = '"config"' in resp_body or '"application"' in resp_body
                else:
                    success = len(resp_body) > 50

                evidence = f"{desc}" + (" — content exposed" if success else " — limited content")
            else:
                evidence = f"{desc} — access denied (status {status})"

            return _label("info_disclosure", rules, success, evidence)

    # Error response with stack trace / framework info (regardless of endpoint)
    if isinstance(status, int) and status >= 400:
        if re.search(r'(?:at\s+\w+\s+\([\w./]+:\d+:\d+\)|SequelizeDatabaseError|SQLITE_ERROR'
                     r'|TypeError:\s|ReferenceError:\s|SyntaxError:\s)', resp_body):
            rules.append("js-info-error-stack-trace")
            success = True
            evidence = "Error response leaks stack trace / framework details"
            return _label("info_disclosure", rules, success, evidence)

    return None


# --- Auth Bypass Detection ---------------------------------------------------

def _detect_auth_bypass(method, url, path, path_clean, query, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect authentication bypass attacks."""
    rules = []
    success = False
    evidence = ""

    # Pattern 1: Mass assignment - registration with role or __proto__
    if re.search(r'/api/users/?$', path_clean) and method == "POST":
        body_lower = body.lower()
        if '"role"' in body_lower or "__proto__" in body_lower or "prototype" in body_lower:
            rules.append("js-auth-mass-assignment")
            success = status == 201
            evidence = "Mass assignment registration" + (" — succeeded" if success else " — failed")

    # Pattern 2: JWT alg:none
    auth_hdr = str(headers.get("Authorization", headers.get("authorization", "")))
    if auth_hdr.startswith("Bearer ") and not rules:
        token_parts = auth_hdr[7:].split(".")
        if len(token_parts) >= 2:
            try:
                hdr_b64 = token_parts[0] + "=" * (4 - len(token_parts[0]) % 4)
                hdr_json = base64.urlsafe_b64decode(hdr_b64).decode("utf-8", errors="ignore")
                if re.search(r'"alg"\s*:\s*"none"', hdr_json, re.IGNORECASE):
                    rules.append("js-auth-jwt-none")
                    success = status == 200
                    evidence = "JWT alg:none" + (" — accepted" if success else " — rejected")
            except Exception:
                pass

    # Pattern 3: GET-based password change
    if "/rest/user/change-password" in path_clean and method == "GET":
        rules.append("js-auth-get-password-change")
        success = status == 200 and ('"token"' not in resp_body or "password" in resp_body.lower())
        evidence = "GET-based password change" + (" — succeeded" if success else " — failed")

    # Pattern 4: Direct admin section access
    if ("/rest/admin" in path_clean or "/#/administration" in decoded_path.lower()) and method == "GET":
        rules.append("js-auth-admin-access")
        success = status == 200 and len(resp_body) > 100
        evidence = "Admin section access" + (" — succeeded" if success else " — denied")

    # Pattern 5: Cookie manipulation
    cookie = str(headers.get("Cookie", headers.get("cookie", "")))
    if "isadmin=true" in cookie.lower() or "role=admin" in cookie.lower():
        if not rules:  # Don't double-count
            rules.append("js-auth-cookie-manipulation")
            success = status == 200
            evidence = "Cookie-based auth bypass" + (" — succeeded" if success else " — failed")

    # Pattern 6: Forged feedback (posting as different user)
    if re.search(r'/api/feedbacks/?$', path_clean) and method == "POST":
        if '"UserId"' in body:
            rules.append("js-auth-forged-feedback")
            success = status == 201
            evidence = "Forged feedback" + (" — succeeded" if success else " — failed")

    # Pattern 7: Forged review (posting as different author)
    if re.search(r'/rest/products/\d+/reviews', path_clean) and method in ("PUT", "PATCH", "POST"):
        if '"author"' in body.lower():
            rules.append("js-auth-forged-review")
            success = status in (200, 201)
            evidence = "Forged review" + (" — succeeded" if success else " — failed")

    if rules:
        return _label("auth_bypass", rules, success, evidence)
    return None


# --- Path Traversal Detection ------------------------------------------------

def _detect_path_traversal(method, url, path, path_clean, query, body, headers,
                           status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect path traversal attacks."""
    if method != "GET":
        return None

    rules = []
    success = False
    evidence = ""

    # Pattern 1: Null byte bypass in FTP (%2500.md, %00.md)
    if "/ftp/" in path.lower():
        if "%2500" in path or "%00" in path:
            rules.append("js-pt-null-byte-bypass")
            success = status == 200 and len(resp_body) > 10
            # Validate it's not just SPA HTML
            if success and ("<app-root" in resp_body or "<!doctype html>" in resp_body.lower()[:200]):
                success = False
            evidence = "Null byte bypass in FTP" + (" — file content returned" if success else " — failed")

    # Pattern 2: Directory traversal sequences
    if not rules and (".." in decoded_path or "%2e%2e" in path.lower()):
        rules.append("js-pt-directory-traversal")
        success = status == 200 and ("root:" in resp_body or "/home/" in resp_body)
        evidence = "Directory traversal" + (" — sensitive content accessed" if success else " — failed")

    # Pattern 3: Encoded slashes for filter bypass
    if not rules and ("%2f" in path.lower() or "%252f" in path.lower()):
        if "/ftp" in path.lower() or "/assets" in path.lower():
            rules.append("js-pt-encoded-slash")
            success = status == 200 and len(resp_body) > 10
            evidence = "Encoded slash bypass" + (" — content accessed" if success else " — failed")

    if rules:
        return _label("path_traversal", rules, success, evidence)
    return None


# --- SSRF Detection ----------------------------------------------------------

_SSRF_TARGETS = re.compile(
    r'(?:localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.\d+\.\d+|'
    r'\[::1\]|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|'
    r'192\.168\.\d+\.\d+|metadata\.google|169\.254\.169\.254)',
    re.IGNORECASE
)


def _detect_ssrf(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect SSRF attacks."""
    if "/profile/image/url" in path_clean and method == "POST":
        rules = ["js-ssrf-profile-image-url"]
        body_lower = body.lower()

        if _SSRF_TARGETS.search(body):
            rules.append("js-ssrf-internal-target")

        # Check for challenge-solving URL pattern
        if "solve/challenges/server-side" in body_lower:
            rules.append("js-ssrf-challenge-solve")

        success = status == 200 and len(resp_body) > 50
        evidence = "SSRF via profile image URL" + (" — response received" if success else f" — status {status}")
        return _label("ssrf", rules, success, evidence)

    # MLflow artifact-location SSRF (if applicable)
    if "artifact_location" in body.lower() or "source" in body.lower():
        if _SSRF_TARGETS.search(body) or "file://" in body.lower() or "gopher://" in body.lower():
            rules = ["js-ssrf-artifact-location"]
            success = status == 200
            evidence = "SSRF via artifact location" + (" — accepted" if success else " — rejected")
            return _label("ssrf", rules, success, evidence)

    return None


# --- Command Injection / RCE Detection ---------------------------------------

def _detect_cmdi(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect command injection and RCE attacks."""
    rules = []
    success = False
    evidence = ""

    # Pattern 1: b2b orders endpoint - eval(orderLinesData)
    if "/b2b/v2/orders" in path_clean and method == "POST":
        if any(kw in body for kw in ["require(", "process.", "child_process",
                                      "exec(", "spawn(", "while(true", "function(",
                                      "global.", "Buffer.", "constructor"]):
            rules.append("js-cmdi-b2b-eval")
            # Success: any 200 response (even empty) means code executed
            if status == 200:
                success = True
                evidence = "RCE via b2b orders eval() — code executed"
            elif status == 500:
                # 500 could mean the injected code caused an error (partial success)
                if "timeout" in resp_body.lower() or "infinite" in resp_body.lower():
                    success = True
                    evidence = "RCE via b2b orders eval() — timeout (code ran)"
                else:
                    evidence = "RCE attempt via b2b orders — execution error"
            else:
                evidence = f"RCE attempt via b2b orders (status {status})"

    # Pattern 2: SSTI via profile username #{...}
    if "/profile" in path_clean and method == "GET":
        if status == 200 and re.search(r'(?:^|\s)(?:\d+|undefined|null|\[object)', resp_body):
            # Check if the response shows evaluation result (not the template itself)
            if "#{" not in resp_body:
                # The template was evaluated, not echoed
                pass  # Hard to detect without seeing the original injection

    if rules:
        return _label("cmdi", rules, success, evidence)
    return None


# --- Success re-evaluation functions (per family) ----------------------------

def _reeval_idor(method, path, path_clean, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate IDOR success with Juice Shop knowledge."""
    if status != 200:
        return None

    # Basket access
    if re.search(r'/rest/basket/\d+', path_clean):
        if any(kw in resp_body for kw in ['"Products"', '"BasketItems"', '"items"']):
            return {"success": True, "evidence": "IDOR: basket data returned (200 with items)"}

    # User data
    if re.search(r'/api/users/\d+', path_clean):
        if '"email"' in resp_body:
            return {"success": True, "evidence": "IDOR: user data exposed (200 with email)"}

    # User listing
    if path_clean == "/api/users":
        if '"email"' in resp_body and '"role"' in resp_body:
            return {"success": True, "evidence": "IDOR: all users listed (200 with emails/roles)"}

    return None


def _reeval_csrf(method, path, path_clean, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate CSRF success."""
    external, _ = _has_external_origin(headers)
    if not external:
        return None

    if method in ("POST", "PUT", "DELETE", "PATCH"):
        if status == 302:
            return {"success": True, "evidence": "CSRF: state change with external origin (302)"}
        if status in (200, 201):
            return {"success": True, "evidence": f"CSRF: state change accepted (status {status})"}

    return None


def _reeval_file_upload(method, path, path_clean, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate file upload success."""
    if method != "POST" or status not in (200, 201, 204):
        return None

    body_lower = body.lower()

    # XXE success: response contains sensitive data
    if "<?xml" in body_lower or ".xml" in body_lower:
        if any(kw in resp_body for kw in ["root:", "/etc/", "ENTITY"]):
            return {"success": True, "evidence": "XXE: sensitive data in response"}
        if status == 200 and len(resp_body) > 50:
            return {"success": True, "evidence": "XXE: XML file processed"}

    # ZIP Slip: accepted
    if ".zip" in body_lower and status in (200, 204):
        return {"success": True, "evidence": "ZIP file processed"}

    # Dangerous extension accepted
    if re.search(r'filename="[^"]*\.(?:php|phtml|jsp|asp)', body_lower):
        if status == 200:
            return {"success": True, "evidence": "Dangerous file type upload accepted"}

    return None


def _reeval_info_disclosure(method, path, path_clean, body, headers,
                            status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate info disclosure success."""
    if status != 200:
        return None

    # Skip SPA HTML responses
    if "<app-root" in resp_body or "<!doctype html>" in resp_body.lower()[:200]:
        if len(resp_body) < 5000:
            return None

    # FTP files
    if "/ftp" in path_clean and len(resp_body) > 10:
        return {"success": True, "evidence": "FTP file content returned"}

    # Encryption keys
    if "/encryptionkeys" in path_clean and len(resp_body) > 10:
        return {"success": True, "evidence": "Encryption key file returned"}

    # Metrics
    if path_clean.endswith("/metrics"):
        if "# HELP" in resp_body or "http_request" in resp_body:
            return {"success": True, "evidence": "Prometheus metrics exposed"}

    # Access logs
    if "/support/logs" in path_clean and len(resp_body) > 50:
        return {"success": True, "evidence": "Access logs exposed"}

    # Stack trace in error response
    if re.search(r'at\s+\w+\s+\([\w./]+:\d+:\d+\)', resp_body):
        return {"success": True, "evidence": "Stack trace exposed in response"}

    return None


def _reeval_path_traversal(method, path, path_clean, body, headers,
                           status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate path traversal success."""
    if status != 200:
        return None

    # Null byte bypass
    if "%2500" in path or "%00" in path:
        if len(resp_body) > 10 and "<app-root" not in resp_body:
            return {"success": True, "evidence": "Null byte bypass: file content returned"}

    # Actual file content (not SPA HTML)
    if ".." in decoded_path:
        if "root:" in resp_body or "/etc/" in resp_body:
            return {"success": True, "evidence": "Path traversal: sensitive file content"}

    return None


def _reeval_auth_bypass(method, path, path_clean, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate auth bypass success."""
    # Login with token returned
    if "/rest/user/login" in path_clean and method == "POST":
        if status == 200 and '"token"' in resp_body:
            # Check if this used SQLi-style auth bypass
            body_lower = body.lower()
            if any(kw in body_lower for kw in ["' or", "' --", "1=1", "admin'", "' ||"]):
                return {"success": True, "evidence": "Auth bypass via SQLi login"}

    # Admin access with 200
    if "/rest/admin" in path_clean and status == 200 and method == "GET":
        if len(resp_body) > 100:
            return {"success": True, "evidence": "Admin section accessed"}

    # Mass assignment registration
    if re.search(r'/api/users/?$', path_clean) and method == "POST" and status == 201:
        if '"role"' in body.lower() or "__proto__" in body.lower():
            return {"success": True, "evidence": "Mass assignment: user created with custom role"}

    return None


# Mapping family -> re-evaluation function
_SUCCESS_REEVAL = {
    "idor": _reeval_idor,
    "csrf": _reeval_csrf,
    "file_upload": _reeval_file_upload,
    "info_disclosure": _reeval_info_disclosure,
    "path_traversal": _reeval_path_traversal,
    "auth_bypass": _reeval_auth_bypass,
}
