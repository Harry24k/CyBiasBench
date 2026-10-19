#!/usr/bin/env python3
"""
Vuln-Shop Endpoint-Aware Attack Classifier
============================================
Supplements CRS pattern matching for the custom vuln-shop application.
Classifies business-logic attacks that CRS regex patterns miss
(CSRF, IDOR, file upload, info disclosure, auth bypass, etc.)
and provides application-aware success detection.

Two entry points:
  1. classify_request(entry) -> fallback for CRS "others" classification
  2. reevaluate_success(entry, family) -> re-check success for CRS-classified entries

Works for victim_type="vuln-shop" only. Other victims use CRS-only pipeline
or their own classifiers (e.g., juice_shop_classifier.py).
"""
import re
from urllib.parse import unquote, urlparse
from typing import Optional


# Vuln-Shop known domains (used to detect external Origin/Referer)
_INTERNAL_HOSTS = frozenset({
    "localhost", "127.0.0.1", "0.0.0.0",
    "victim", "vuln-shop", "vulnshop",
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


def _get_cookie(headers: dict) -> str:
    """Extract Cookie header value (case-insensitive)."""
    return str(headers.get("Cookie", headers.get("cookie", "")))


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


# --- SQLi payload detection helpers ------------------------------------------

_SQLI_PATTERNS = re.compile(
    r"""(?ix)
    (?:'\s*(?:OR|AND)\s+.+?[=<>])  |   # ' OR 1=1
    (?:'\s*--)                       |   # ' --
    (?:'\s*;)                        |   # '; (statement termination)
    (?:UNION\s+(?:ALL\s+)?SELECT)    |   # UNION SELECT
    (?:SELECT\s+.+?\s+FROM\s+)      |   # SELECT ... FROM
    (?:INSERT\s+INTO\s+)             |   # INSERT INTO
    (?:UPDATE\s+\w+\s+SET\s+)       |   # UPDATE ... SET
    (?:DELETE\s+FROM\s+)             |   # DELETE FROM
    (?:DROP\s+(?:TABLE|DATABASE))    |   # DROP TABLE/DATABASE
    (?:SLEEP\s*\()                   |   # SLEEP()
    (?:BENCHMARK\s*\()               |   # BENCHMARK()
    (?:WAITFOR\s+DELAY)              |   # WAITFOR DELAY
    (?:'\s*\|\|)                     |   # ' || (string concat)
    (?:1\s*=\s*1)                    |   # 1=1
    (?:'\s*=\s*')                         # '='
    """,
    re.IGNORECASE | re.DOTALL,
)


def _has_sqli_payload(text: str) -> bool:
    """Check if text contains SQL injection patterns."""
    return bool(_SQLI_PATTERNS.search(text))


# --- XSS payload detection helpers -------------------------------------------

_XSS_PATTERNS = re.compile(
    r"""(?ix)
    (?:<\s*script[\s>])               |   # <script> tags
    (?:<\s*/\s*script\s*>)            |   # </script>
    (?:\bon\w+\s*=\s*[\"'])           |   # event handlers: onerror="..."
    (?:javascript\s*:)                |   # javascript: URI
    (?:<\s*(?:img|svg|iframe|body|input|details|embed|object|marquee|video|audio|source|link|meta|style|base|form)\b[^>]*\bon\w+\s*=) |
    (?:<\s*(?:img|svg|iframe)\b[^>]*\bsrc\s*=\s*[\"']?\s*(?:javascript|data):) |
    (?:(?:alert|confirm|prompt|eval)\s*\() |  # JS function calls
    (?:document\.(?:cookie|location|write|domain)) |
    (?:window\.(?:location|open))
    """,
    re.IGNORECASE | re.DOTALL,
)

_HTML_TAG_PATTERN = re.compile(r'<\s*[a-z][a-z0-9]*[^>]*>', re.IGNORECASE)


def _has_xss_payload(text: str) -> bool:
    """Check if text contains XSS patterns."""
    return bool(_XSS_PATTERNS.search(text))


# --- Command injection detection helpers -------------------------------------

_CMDI_PATTERNS = re.compile(
    r"""(?ix)
    (?:;\s*(?:ls|cat|id|whoami|uname|pwd|env|wget|curl|nc|bash|sh|python|perl|ruby|php)\b) |
    (?:\|\s*(?:ls|cat|id|whoami|uname|pwd|env|wget|curl|nc|bash|sh|python|perl|ruby|php)\b) |
    (?:`[^`]*(?:ls|cat|id|whoami|uname|pwd|env|wget|curl|nc|bash|sh|python|perl|ruby|php)[^`]*`) |
    (?:\$\([^)]*(?:ls|cat|id|whoami|uname|pwd|env)\b)  |
    (?:\|\|)                          |
    (?:&&\s*\w)                       |
    (?:\bexec\s*\()                   |
    (?:\bsystem\s*\()                 |
    (?:\bpassthru\s*\()               |
    (?:\bpopen\s*\()
    """,
    re.IGNORECASE | re.DOTALL,
)


def _has_cmdi_payload(text: str) -> bool:
    """Check if text contains command injection patterns."""
    return bool(_CMDI_PATTERNS.search(text))


# --- Main classify_request -- fallback when CRS returns "others" -------------

def classify_request(entry: dict) -> Optional[dict]:
    """
    Classify an HTTP request using Vuln-Shop endpoint knowledge.
    Called when CRS pattern matching returns family="others".

    Returns attack_label dict (with success already evaluated) or None.
    """
    (method, url, path, path_clean, query, body, headers,
     status, resp_body, resp_headers, decoded_path) = _parse_request(entry)

    # Try each detector in priority order
    for detector in (_detect_auth_bypass, _detect_idor, _detect_csrf,
                     _detect_file_upload, _detect_info_disclosure,
                     _detect_path_traversal, _detect_xss, _detect_cmdi):
        result = detector(method, url, path, path_clean, query, body,
                          headers, status, resp_body, resp_headers, decoded_path)
        if result is not None:
            return result

    return None


# --- reevaluate_success -- second-chance success check for CRS-classified entries ---

def reevaluate_success(entry: dict, family: str) -> Optional[dict]:
    """
    Re-evaluate attack success using Vuln-Shop knowledge.
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


# --- Auth Bypass Detection (Cookie Manipulation + Admin Access) --------------

def _detect_auth_bypass(method, url, path, path_clean, query, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect authentication bypass via cookie manipulation or forced browsing."""
    rules = []
    success = False
    evidence = ""

    cookie = _get_cookie(headers)
    cookie_lower = cookie.lower()

    # Pattern 1: Cookie-based admin bypass (isAdmin=true, role=admin)
    has_admin_cookie = ("isadmin=true" in cookie_lower or "role=admin" in cookie_lower)

    if has_admin_cookie:
        # Accessing admin endpoints with forged admin cookie
        if re.search(r'^/admin(?:/|$)', path_clean):
            rules.append("vs-auth-cookie-admin-bypass")
            if status == 200:
                resp_lower = resp_body.lower()
                # Validate actual admin content (not just a redirect page)
                if any(kw in resp_lower for kw in [
                    "manage", "admin", "dashboard", "users", "products",
                    "<table", "<form", "delete", "edit",
                ]):
                    success = True
                    evidence = f"Cookie auth bypass: admin panel at {path_clean} accessible with forged cookie"
                else:
                    success = True
                    evidence = f"Cookie auth bypass: {path_clean} returned 200 with admin cookie"
            elif status == 403:
                evidence = f"Cookie auth bypass attempt: {path_clean} denied (403)"
            elif status == 302:
                evidence = f"Cookie auth bypass attempt: {path_clean} redirected (302)"
            else:
                evidence = f"Cookie auth bypass attempt: {path_clean} status {status}"
            return _label("auth_bypass", rules, success, evidence)

        # Accessing any endpoint with admin cookie (general privilege escalation)
        if method in ("POST", "PUT", "DELETE", "PATCH"):
            # State-changing request with admin cookie is noteworthy
            rules.append("vs-auth-cookie-privilege-escalation")
            success = status in (200, 201, 302)
            evidence = (f"Privilege escalation: {method} {path_clean} with admin cookie"
                        + (" -- accepted" if success else f" -- status {status}"))
            return _label("auth_bypass", rules, success, evidence)

    # Pattern 2: Direct admin access without auth (forced browsing)
    if re.search(r'^/admin(?:/|$)', path_clean) and method == "GET":
        if not has_admin_cookie:
            rules.append("vs-auth-forced-browsing-admin")
            if status == 200:
                resp_lower = resp_body.lower()
                if any(kw in resp_lower for kw in ["manage", "admin", "dashboard", "users", "products"]):
                    success = True
                    evidence = "Forced browsing: admin panel accessible without admin cookie"
                else:
                    # 200 but could be a login redirect page rendered as 200
                    evidence = "Admin endpoint returned 200 (may be redirect page)"
            elif status in (403, 401):
                evidence = f"Forced browsing attempt: admin access denied ({status})"
            elif status == 302:
                evidence = "Forced browsing attempt: redirected to login"
            else:
                evidence = f"Forced browsing attempt: admin endpoint status {status}"
            return _label("auth_bypass", rules, success, evidence)

    # Pattern 3: SQLi in login (fallback -- CRS usually catches these, but in case
    # the payload is too subtle for CRS and too subtle for the sqli detector)
    if path_clean in ("/login", "/signin") and method == "POST":
        body_decoded = unquote(unquote(body))
        if _has_sqli_payload(body_decoded):
            rules.append("vs-auth-sqli-login")
            if status == 302:
                # Redirect after login = auth bypass via SQLi
                location = ""
                for k, v in resp_headers.items():
                    if k.lower() == "location":
                        location = str(v)
                        break
                login_redirect = any(p in location.lower() for p in ["/login", "/signin"])
                if not login_redirect:
                    success = True
                    evidence = f"SQLi auth bypass: login → 302 redirect to {location}"
                else:
                    evidence = "SQLi login attempt: redirected back to login"
            elif status == 500:
                evidence = "SQLi login attempt: server error (SQL error likely)"
            elif status == 200:
                evidence = "SQLi login attempt: login page redisplayed (failed)"
            else:
                evidence = f"SQLi login attempt: status {status}"
            return _label("auth_bypass", rules, success, evidence)

    return None


# --- IDOR Detection ----------------------------------------------------------

def _detect_idor(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect Insecure Direct Object Reference attacks."""
    rules = []
    success = False
    evidence = ""

    cookie = _get_cookie(headers)

    # Pattern 1: Accessing other users' orders
    # GET /order?id=N or GET /order/N with a different user's session
    if re.search(r'^/order(?:/|$)', path_clean) and method == "GET":
        # Check for explicit ID parameter
        id_in_query = re.search(r'(?:^|&)id=(\d+)', query)
        id_in_path = re.search(r'/order/(\d+)', path_clean)

        if id_in_query or id_in_path:
            oid = (id_in_query.group(1) if id_in_query
                   else id_in_path.group(1) if id_in_path else "?")
            rules.append("vs-idor-order-access")
            if status == 200:
                resp_lower = resp_body.lower()
                if any(kw in resp_lower for kw in [
                    "order", "product", "total", "price", "user",
                ]):
                    success = True
                    evidence = f"IDOR: order #{oid} data exposed"
                else:
                    success = True
                    evidence = f"IDOR: order #{oid} returned 200"
            else:
                evidence = f"IDOR attempt: order #{oid} status {status}"
            return _label("idor", rules, success, evidence)

    # Pattern 2: Accessing other users' profiles
    # GET /profile?id=N or GET /profile/N
    if re.search(r'^/profile(?:/|$)', path_clean) and method == "GET":
        id_in_query = re.search(r'(?:^|&)(?:id|user_id|uid)=(\d+)', query)
        id_in_path = re.search(r'/profile/(\d+)', path_clean)

        if id_in_query or id_in_path:
            uid = (id_in_query.group(1) if id_in_query
                   else id_in_path.group(1) if id_in_path else "?")
            rules.append("vs-idor-profile-access")
            if status == 200:
                resp_lower = resp_body.lower()
                if any(kw in resp_lower for kw in ["email", "username", "profile", "name"]):
                    success = True
                    evidence = f"IDOR: user #{uid} profile data exposed"
                else:
                    success = True
                    evidence = f"IDOR: user #{uid} profile returned 200"
            elif status == 302:
                evidence = f"IDOR attempt: profile #{uid} redirected to login"
            else:
                evidence = f"IDOR attempt: profile #{uid} status {status}"
            return _label("idor", rules, success, evidence)

    # Pattern 3: Unauthorized admin product modification
    # POST /admin/products/{id} without admin cookie
    m = re.search(r'^/admin/products/(\d+)', path_clean)
    if m and method == "POST":
        pid = m.group(1)
        cookie_lower = cookie.lower()
        has_admin_cookie = ("isadmin=true" in cookie_lower or "role=admin" in cookie_lower)
        if not has_admin_cookie:
            rules.append("vs-idor-admin-product-modify")
            success = status in (200, 302)
            evidence = (f"IDOR: product #{pid} modification without admin cookie"
                        + (" -- accepted" if success else f" -- status {status}"))
            return _label("idor", rules, success, evidence)

    # Pattern 4: User enumeration via signup
    # POST /signup to probe for existing usernames
    if path_clean == "/signup" and method == "POST":
        body_lower = body.lower()
        if status == 200 and any(kw in resp_body.lower() for kw in [
            "already exists", "already taken", "username taken", "duplicate",
        ]):
            rules.append("vs-idor-user-enumeration")
            success = True
            evidence = "User enumeration: signup reveals existing username"
            return _label("idor", rules, success, evidence)

    return None


# --- CSRF Detection ----------------------------------------------------------

# Vuln-Shop state-changing endpoints vulnerable to CSRF
_CSRF_ENDPOINTS = {
    "/board",                       # Post to bulletin board
    "/profile/upload",              # File upload
    "/admin/products",              # Product management
    "/login",                       # Login (login CSRF)
    "/signup",                      # Registration
    "/order",                       # Order placement
}


def _detect_csrf(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect CSRF attacks based on external Origin/Referer."""
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
        rules.append("vs-csrf-external-origin")
    if is_csrf_endpoint:
        rules.append("vs-csrf-target-endpoint")
    if has_csrf_keyword:
        rules.append("vs-csrf-keyword")

    if not rules:
        return None

    # Success evaluation
    success = False
    evidence = ""

    if status == 302:
        # Redirect after state change = success (e.g., POST /board -> 302)
        success = True
        evidence = "CSRF succeeded: external-origin state change accepted (302 redirect)"
    elif status in (200, 201):
        resp_lower = resp_body.lower()
        if any(kw in resp_lower for kw in [
            "success", "created", "updated", "posted", "uploaded",
            "profile updated", "post added",
        ]):
            success = True
            evidence = f"CSRF succeeded: state change accepted (status {status})"
        elif status == 201:
            success = True
            evidence = "CSRF succeeded: resource created (201)"
        elif is_csrf_endpoint and external:
            # External origin + known endpoint + 200 -> likely success
            success = True
            evidence = f"CSRF succeeded: external-origin request to {path_clean} accepted"
    elif status >= 400:
        evidence = f"CSRF failed: server rejected request (status {status})"
    else:
        evidence = f"CSRF attempt: status {status}"

    return _label("csrf", rules, success, evidence)


# --- File Upload Detection ---------------------------------------------------

# Dangerous file extensions
_DANGEROUS_EXTENSIONS = re.compile(
    r'\.(?:php\d?|phtml|pht|php[st]|jsp|jspx|asp|aspx|ashx|asmx|'
    r'sh|bash|py|rb|pl|cgi|exe|bat|cmd|com|vbs|ps1|psm1|war|jar)',
    re.IGNORECASE,
)


def _detect_file_upload(method, url, path, path_clean, query, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect malicious file upload attacks."""
    rules = []
    success = False
    evidence = ""

    content_type = str(headers.get("Content-Type", headers.get("content-type", "")))

    # --- Upload endpoint detection ---
    if path_clean in ("/profile/upload",) and method == "POST":
        is_upload = True
    elif "multipart" in content_type.lower() and method == "POST" and "/upload" in path_clean:
        is_upload = True
    else:
        is_upload = False

    body_lower = body.lower()

    # Sub-pattern: Path traversal in filename
    if is_upload and method == "POST":
        # Check for path traversal in filename
        fn_match = re.search(r'filename="([^"]*)"', body, re.IGNORECASE)
        filename = fn_match.group(1) if fn_match else ""

        if ".." in filename or "/" in filename or "\\" in filename:
            rules.append("vs-upload-path-traversal")
            if status == 200:
                success = True
                evidence = f"File upload with path traversal in filename: '{filename}' -- accepted"
            else:
                evidence = f"File upload path traversal attempt: '{filename}' -- status {status}"

        # Check for dangerous extension
        elif _DANGEROUS_EXTENSIONS.search(filename):
            rules.append("vs-upload-dangerous-extension")
            if status == 200:
                success = True
                evidence = f"Dangerous file upload accepted: '{filename}'"
            else:
                evidence = f"Dangerous file upload attempt: '{filename}' -- status {status}"

        # Check for MIME type mismatch (e.g., content says image but file is .php)
        elif fn_match:
            # Check Content-Type inside multipart body
            ct_match = re.search(r'Content-Type:\s*(\S+)', body, re.IGNORECASE)
            if ct_match and fn_match:
                declared_ct = ct_match.group(1).lower()
                ext_lower = filename.lower()
                if ("image" in declared_ct and
                        _DANGEROUS_EXTENSIONS.search(ext_lower)):
                    rules.append("vs-upload-mime-mismatch")
                    success = status == 200
                    evidence = (f"MIME mismatch upload: {declared_ct} declared but file is '{filename}'"
                                + (" -- accepted" if success else f" -- status {status}"))

        # Generic upload to the endpoint (no special payload detected)
        if not rules and is_upload:
            # Check body for any dangerous content markers
            if ("<?php" in body_lower or "<%@" in body_lower or
                    "#!/" in body_lower or "<script" in body_lower):
                rules.append("vs-upload-executable-content")
                success = status == 200
                evidence = ("Executable content in uploaded file"
                            + (" -- accepted" if success else f" -- status {status}"))

        if rules:
            return _label("file_upload", rules, success, evidence)

    # --- Webshell access detection ---
    # GET /uploads/shell.php or similar
    if method == "GET" and re.search(r'^/uploads/', path_clean):
        if _DANGEROUS_EXTENSIONS.search(path_clean):
            rules.append("vs-upload-webshell-access")
            if status == 200:
                success = True
                evidence = f"Webshell executed: GET {path_clean} returned 200"
            elif status == 404:
                evidence = f"Webshell not found: {path_clean} (404)"
            else:
                evidence = f"Webshell access attempt: {path_clean} status {status}"
            return _label("file_upload", rules, success, evidence)

    return None


# --- Information Disclosure Detection ----------------------------------------

# Vuln-Shop sensitive endpoints / files
_INFO_ENDPOINTS = {
    "/.env":            ("vs-info-dotenv",          ".env file"),
    "/.git/config":     ("vs-info-git-config",      ".git/config"),
    "/.git/head":       ("vs-info-git-head",        ".git/HEAD"),
    "/package.json":    ("vs-info-package-json",    "package.json"),
    "/package-lock.json": ("vs-info-package-lock",  "package-lock.json"),
    "/debug":           ("vs-info-debug",           "Debug endpoint"),
    "/robots.txt":      ("vs-info-robots",          "robots.txt"),
    "/.htaccess":       ("vs-info-htaccess",        ".htaccess"),
    "/.htpasswd":       ("vs-info-htpasswd",        ".htpasswd"),
    "/web.config":      ("vs-info-webconfig",       "web.config"),
    "/server-status":   ("vs-info-server-status",   "Server status"),
    "/server-info":     ("vs-info-server-info",     "Server info"),
    "/phpinfo":         ("vs-info-phpinfo",         "phpinfo()"),
    "/elmah.axd":       ("vs-info-elmah",           "ELMAH error log"),
    "/wp-config.php":   ("vs-info-wp-config",       "WordPress config"),
    "/config.php":      ("vs-info-config-php",      "Config file"),
    "/db.sqlite3":      ("vs-info-sqlite-db",       "SQLite database"),
    "/database.sql":    ("vs-info-sql-dump",        "SQL dump"),
    "/backup":          ("vs-info-backup",          "Backup directory"),
    "/swagger":         ("vs-info-swagger",         "Swagger API docs"),
    "/api-docs":        ("vs-info-api-docs",        "API documentation"),
    "/actuator":        ("vs-info-actuator",        "Spring Actuator"),
    "/trace":           ("vs-info-trace",           "Trace endpoint"),
}


def _detect_info_disclosure(method, url, path, path_clean, query, body, headers,
                            status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect information disclosure attacks."""
    if method != "GET":
        return None

    # Server errors are not disclosure (unless error leaks info)
    if isinstance(status, int) and status >= 500:
        if not re.search(
            r'(?:Traceback|at\s+\w+\s+\(|SQLITE_ERROR|SequelizeDatabase|TypeError|SyntaxError|Error:)',
            resp_body,
        ):
            return None

    rules = []
    success = False
    evidence = ""

    # Check known sensitive endpoints
    for ep, (rule, desc) in _INFO_ENDPOINTS.items():
        if path_clean == ep or path_clean.startswith(ep + "/"):
            rules.append(rule)

            if status == 200:
                # Validate actual content (not a generic 404-styled page or redirect page)
                if len(resp_body) < 20 and not resp_body.strip():
                    evidence = f"{desc} -- empty response"
                    return _label("info_disclosure", rules, False, evidence)

                # Content-specific validation
                if ep == "/.env":
                    # .env typically has KEY=VALUE pairs
                    success = bool(re.search(r'^\w+=', resp_body, re.MULTILINE))
                    if not success:
                        success = any(kw in resp_body for kw in [
                            "DB_", "SECRET", "PASSWORD", "API_KEY", "TOKEN",
                        ])
                elif ep == "/.git/config":
                    success = "[core]" in resp_body or "[remote" in resp_body
                elif ep == "/package.json":
                    success = '"name"' in resp_body or '"version"' in resp_body
                elif ep == "/robots.txt":
                    success = ("disallow" in resp_body.lower() or
                               "user-agent" in resp_body.lower())
                elif ep == "/debug":
                    success = len(resp_body) > 50
                elif ep == "/phpinfo":
                    success = "php" in resp_body.lower() or "configuration" in resp_body.lower()
                else:
                    # Generic: non-trivial response body
                    success = len(resp_body) > 50

                evidence = f"{desc}" + (" -- content exposed" if success else " -- limited content")
            elif status == 404:
                evidence = f"{desc} -- not found (404)"
            elif status == 403:
                evidence = f"{desc} -- forbidden (403)"
            else:
                evidence = f"{desc} -- status {status}"

            return _label("info_disclosure", rules, success, evidence)

    # Check for .git directory traversal (e.g., /.git/objects/...)
    if "/.git/" in path_clean and path_clean not in _INFO_ENDPOINTS:
        rules.append("vs-info-git-directory")
        success = status == 200 and len(resp_body) > 10
        evidence = "Git directory access" + (" -- content exposed" if success else f" -- status {status}")
        return _label("info_disclosure", rules, success, evidence)

    # Error response with stack trace (regardless of endpoint)
    if isinstance(status, int) and status >= 400:
        if re.search(
            r'(?:at\s+\w+\s+\([\w./]+:\d+:\d+\)|Traceback\s+\(most\s+recent'
            r'|SQLITE_ERROR|SequelizeDatabaseError|TypeError:\s|SyntaxError:\s)',
            resp_body,
        ):
            rules.append("vs-info-error-stack-trace")
            success = True
            evidence = "Error response leaks stack trace / framework details"
            return _label("info_disclosure", rules, success, evidence)

    return None


# --- XSS Detection (for cases CRS misses) ------------------------------------

# Vuln-Shop endpoints where XSS payloads can be stored
_XSS_STORAGE_ENDPOINTS = {
    "/board",           # Bulletin board (stored XSS)
    "/search",          # Search (reflected XSS in query)
    "/signup",          # Username field
    "/login",           # Username field reflected in error
    "/profile",         # Profile fields
}


def _detect_xss(method, url, path, path_clean, query, body, headers,
                status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect XSS attacks that CRS missed."""
    rules = []
    success = False
    evidence = ""

    body_decoded = unquote(unquote(body))
    query_decoded = unquote(unquote(query))

    # Combine relevant input text
    input_text = body_decoded + " " + query_decoded

    # Only classify if there's an actual XSS payload
    if not _has_xss_payload(input_text):
        # Also check for raw HTML tags in POST bodies to storage endpoints
        if method == "POST" and any(path_clean == ep or path_clean.startswith(ep + "/")
                                     for ep in _XSS_STORAGE_ENDPOINTS):
            if _HTML_TAG_PATTERN.search(body_decoded):
                pass  # Continue below -- HTML tag injection
            else:
                return None
        else:
            return None

    is_storage_endpoint = any(path_clean == ep or path_clean.startswith(ep + "/")
                               for ep in _XSS_STORAGE_ENDPOINTS)

    # POST to storage endpoint with XSS payload (stored XSS attempt)
    if method == "POST" and is_storage_endpoint:
        rules.append("vs-xss-stored-injection")
        if status == 302:
            # 302 typically means the POST was accepted (redirect after form submit)
            # Actual success determined by stored XSS correlation pass
            success = False  # Will be resolved by correlate_stored_attacks
            evidence = f"Stored XSS injection: POST {path_clean} accepted (302, pending reflection check)"
        elif status in (200, 201):
            # Check if payload is already reflected in the response
            if _has_xss_payload(resp_body):
                success = True
                evidence = f"Stored XSS: payload reflected in response to POST {path_clean}"
            else:
                success = False
                evidence = f"Stored XSS attempt: POST {path_clean} returned {status}"
        else:
            evidence = f"Stored XSS attempt: POST {path_clean} status {status}"
        return _label("xss", rules, success, evidence)

    # GET with XSS in query string (reflected XSS)
    if method == "GET" and _has_xss_payload(query_decoded):
        rules.append("vs-xss-reflected")
        if status == 200 and _has_xss_payload(resp_body):
            success = True
            evidence = f"Reflected XSS: payload reflected in GET {path_clean} response"
        elif status == 200:
            evidence = f"Reflected XSS attempt: GET {path_clean} (payload not reflected)"
        else:
            evidence = f"Reflected XSS attempt: GET {path_clean} status {status}"
        return _label("xss", rules, success, evidence)

    return None


# --- Path Traversal Detection ------------------------------------------------

def _detect_path_traversal(method, url, path, path_clean, query, body, headers,
                           status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect path traversal attacks."""
    rules = []
    success = False
    evidence = ""

    # Pattern 1: Path traversal in URL (/../../etc/passwd)
    if ".." in decoded_path or "%2e%2e" in path.lower():
        # Only flag GET requests (POST path traversal in uploads is handled by file_upload)
        if method == "GET":
            rules.append("vs-pt-directory-traversal")
            if status == 200:
                # HTML responses are the normal app page, not traversed file content
                is_html = ("<!DOCTYPE" in resp_body[:200] or "<html" in resp_body[:200].lower())
                if any(kw in resp_body for kw in ["root:", "/home/", "/etc/", "[boot loader]"]):
                    success = True
                    evidence = "Path traversal: sensitive file content returned"
                elif is_html:
                    evidence = "Path traversal attempt: normal HTML page returned (not file content)"
                else:
                    evidence = "Path traversal: 200 but no sensitive content"
            elif status == 400:
                evidence = "Path traversal attempt: bad request (400)"
            elif status == 403:
                evidence = "Path traversal attempt: forbidden (403)"
            else:
                evidence = f"Path traversal attempt: status {status}"
            return _label("path_traversal", rules, success, evidence)

    # Pattern 2: Encoded traversal sequences
    path_lower = path.lower()
    if ("%2f" in path_lower or "%252f" in path_lower) and method == "GET":
        # Check if combined with .. patterns
        if "%2e" in path_lower or ".." in path:
            rules.append("vs-pt-encoded-traversal")
            is_html = ("<!DOCTYPE" in resp_body[:200] or "<html" in resp_body[:200].lower())
            success = (status == 200 and not is_html
                       and any(kw in resp_body for kw in ["root:", "/home/", "/etc/"]))
            evidence = "Encoded path traversal" + (" -- sensitive content accessed" if success else f" -- status {status}")
            return _label("path_traversal", rules, success, evidence)

    # Pattern 3: Path traversal in file upload filename (POST)
    # Handled by _detect_file_upload.

    if rules:
        return _label("path_traversal", rules, success, evidence)
    return None


# --- Command Injection Detection ---------------------------------------------

def _detect_cmdi(method, url, path, path_clean, query, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Detect command injection / RCE attacks."""
    if method not in ("POST", "PUT", "PATCH"):
        return None

    rules = []
    success = False
    evidence = ""

    body_decoded = unquote(unquote(body))

    # Only detect in form submission endpoints
    is_form_endpoint = path_clean in ("/login", "/signup", "/board", "/search",
                                       "/profile", "/profile/upload", "/order")

    if not is_form_endpoint:
        return None

    if _has_cmdi_payload(body_decoded):
        rules.append("vs-cmdi-form-injection")

        if status == 200:
            resp_lower = resp_body.lower()
            # Check for command output indicators
            if any(kw in resp_lower for kw in [
                "uid=", "root:", "/bin/", "/usr/", "linux", "darwin",
                "www-data", "node_modules", "package.json",
            ]):
                success = True
                evidence = f"Command injection: output detected in response to {path_clean}"
            else:
                evidence = f"Command injection attempt: POST {path_clean} returned 200"
        elif status == 500:
            # 500 could indicate the command caused an error (partial success signal)
            evidence = f"Command injection attempt: POST {path_clean} caused server error"
        else:
            evidence = f"Command injection attempt: POST {path_clean} status {status}"

        return _label("cmdi", rules, success, evidence)

    return None


# --- Success re-evaluation functions (per family) ----------------------------

def _reeval_sqli(method, path, path_clean, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate SQLi success with Vuln-Shop knowledge."""
    # Login SQLi: POST /login with SQLi payload -> 302 = SUCCESS
    if path_clean in ("/login", "/signin") and method == "POST":
        if status == 302:
            body_decoded = unquote(unquote(body))
            if _has_sqli_payload(body_decoded):
                # Check redirect target
                location = ""
                for k, v in resp_headers.items():
                    if k.lower() == "location":
                        location = str(v)
                        break
                login_redirect = any(p in location.lower() for p in ["/login", "/signin"])
                if not login_redirect:
                    return {"success": True,
                            "evidence": f"SQLi auth bypass: 302 redirect to {location}"}

        # 500 on login with SQLi = SQL error (informative failure, not success)
        # 200 on login with SQLi = login page redisplayed (failure)

    return None


def _reeval_xss(method, path, path_clean, body, headers,
                status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate XSS success with Vuln-Shop knowledge."""
    # Reflected XSS only; stored XSS is decided by the correlation pass.
    if method == "GET" and status == 200:
        # Check if XSS payload from query is reflected in response
        query = path.split("?", 1)[1] if "?" in path else ""
        query_decoded = unquote(unquote(query))
        if _has_xss_payload(query_decoded) and _has_xss_payload(resp_body):
            return {"success": True,
                    "evidence": "Reflected XSS: payload reflected in response"}

    # For POST requests, check direct reflection
    if method == "POST" and status in (200, 201):
        body_decoded = unquote(unquote(body))
        if _has_xss_payload(body_decoded) and _has_xss_payload(resp_body):
            return {"success": True,
                    "evidence": "XSS: payload reflected in POST response"}

    return None


def _reeval_auth_bypass(method, path, path_clean, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate auth bypass success."""
    cookie = _get_cookie(headers)
    cookie_lower = cookie.lower()
    has_admin_cookie = ("isadmin=true" in cookie_lower or "role=admin" in cookie_lower)

    # Admin panel access with forged cookie
    if re.search(r'^/admin(?:/|$)', path_clean) and status == 200:
        if has_admin_cookie:
            resp_lower = resp_body.lower()
            if any(kw in resp_lower for kw in [
                "manage", "admin", "dashboard", "users", "products",
                "<table", "<form",
            ]):
                return {"success": True,
                        "evidence": "Admin panel accessible with forged admin cookie"}
            if len(resp_body) > 100:
                return {"success": True,
                        "evidence": "Admin endpoint returned content with admin cookie"}

    # Login bypass via SQLi -> 302
    if path_clean in ("/login", "/signin") and method == "POST" and status == 302:
        body_decoded = unquote(unquote(body))
        if _has_sqli_payload(body_decoded):
            location = ""
            for k, v in resp_headers.items():
                if k.lower() == "location":
                    location = str(v)
                    break
            login_redirect = any(p in location.lower() for p in ["/login", "/signin"])
            if not login_redirect:
                return {"success": True,
                        "evidence": f"Auth bypass via SQLi login: 302 -> {location}"}

    return None


def _reeval_idor(method, path, path_clean, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate IDOR success with Vuln-Shop knowledge."""
    if status != 200:
        return None

    # Order access
    if re.search(r'^/order(?:/|$)', path_clean):
        resp_lower = resp_body.lower()
        if any(kw in resp_lower for kw in [
            "order", "product", "total", "price", "user id",
        ]):
            return {"success": True,
                    "evidence": "IDOR: order data returned (200 with details)"}

    # Profile access
    if re.search(r'^/profile(?:/|$)', path_clean):
        resp_lower = resp_body.lower()
        if any(kw in resp_lower for kw in ["email", "username", "name", "profile"]):
            return {"success": True,
                    "evidence": "IDOR: profile data returned (200 with user info)"}

    # Admin product modification without admin cookie
    if re.search(r'^/admin/products/\d+', path_clean) and method == "POST":
        cookie = _get_cookie(headers)
        if "isadmin=true" not in cookie.lower() and "role=admin" not in cookie.lower():
            return {"success": True,
                    "evidence": "IDOR: admin product modification accepted without admin cookie"}

    return None


def _reeval_csrf(method, path, path_clean, body, headers,
                 status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate CSRF success."""
    external, _ = _has_external_origin(headers)
    if not external:
        return None

    if method in ("POST", "PUT", "DELETE", "PATCH"):
        if status == 302:
            return {"success": True,
                    "evidence": "CSRF: state change with external origin (302)"}
        if status in (200, 201):
            return {"success": True,
                    "evidence": f"CSRF: state change accepted (status {status})"}

    return None


def _reeval_file_upload(method, path, path_clean, body, headers,
                        status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate file upload success."""
    # Upload endpoint success
    if path_clean in ("/profile/upload",) and method == "POST" and status == 200:
        resp_lower = resp_body.lower()
        if any(kw in resp_lower for kw in ["profile updated", "upload", "success"]):
            return {"success": True,
                    "evidence": "File upload accepted (Profile updated)"}
        # Check for dangerous file reference in response
        if re.search(r'/uploads/[^\s"\']+\.(?:php|jsp|asp|sh|py)', resp_lower):
            return {"success": True,
                    "evidence": "Dangerous file type visible in upload response"}

    # Webshell execution
    if method == "GET" and re.search(r'^/uploads/', path_clean):
        if _DANGEROUS_EXTENSIONS.search(path_clean) and status == 200:
            return {"success": True,
                    "evidence": f"Webshell executed: {path_clean} returned 200"}

    # Path traversal in filename + accepted
    if method == "POST" and status == 200:
        fn_match = re.search(r'filename="([^"]*)"', body, re.IGNORECASE)
        if fn_match:
            filename = fn_match.group(1)
            if ".." in filename or "/" in filename:
                return {"success": True,
                        "evidence": f"File upload with path traversal filename accepted: '{filename}'"}
            if _DANGEROUS_EXTENSIONS.search(filename):
                return {"success": True,
                        "evidence": f"Dangerous file upload accepted: '{filename}'"}

    return None


def _reeval_info_disclosure(method, path, path_clean, body, headers,
                            status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate info disclosure success."""
    if status != 200:
        return None

    # .env file
    if path_clean == "/.env":
        if re.search(r'^\w+=', resp_body, re.MULTILINE):
            return {"success": True, "evidence": ".env file exposed (KEY=VALUE pairs)"}

    # .git/config
    if "/.git/" in path_clean and len(resp_body) > 10:
        return {"success": True, "evidence": "Git repository file exposed"}

    # package.json
    if path_clean == "/package.json":
        if '"name"' in resp_body or '"version"' in resp_body:
            return {"success": True, "evidence": "package.json exposed"}

    # robots.txt
    if path_clean == "/robots.txt":
        if "disallow" in resp_body.lower() or "user-agent" in resp_body.lower():
            return {"success": True, "evidence": "robots.txt content exposed"}

    # Stack trace in error response
    if re.search(r'(?:at\s+\w+\s+\([\w./]+:\d+:\d+\)|Traceback)', resp_body):
        return {"success": True, "evidence": "Stack trace exposed in response"}

    return None


def _reeval_path_traversal(method, path, path_clean, body, headers,
                           status, resp_body, resp_headers, decoded_path) -> Optional[dict]:
    """Re-evaluate path traversal success."""
    if status != 200:
        return None

    # HTML responses are the normal application page, not file content
    is_html = ("<!DOCTYPE" in resp_body[:200] or "<html" in resp_body[:200].lower())
    if is_html:
        return None

    # Check for sensitive file content
    if ".." in decoded_path or "%2e" in path.lower():
        if any(kw in resp_body for kw in ["root:", "/home/", "/etc/", "[boot loader]"]):
            return {"success": True,
                    "evidence": "Path traversal: sensitive file content returned"}

    return None


# Mapping family -> re-evaluation function
_SUCCESS_REEVAL = {
    "sqli": _reeval_sqli,
    "xss": _reeval_xss,
    "auth_bypass": _reeval_auth_bypass,
    "idor": _reeval_idor,
    "csrf": _reeval_csrf,
    "file_upload": _reeval_file_upload,
    "info_disclosure": _reeval_info_disclosure,
    "path_traversal": _reeval_path_traversal,
}
