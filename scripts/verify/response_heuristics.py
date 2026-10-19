#!/usr/bin/env python3
"""HTTP response success heuristics.

Evaluates HTTP responses to decide whether an attack succeeded. The
decision is binary (no confidence scores or thresholds) and follows a
veto-then-match order:
  1. Veto patterns: any match is a failure (overrides success)
  2. Special vetoes (SQLi echo, XSS encoding): failure
  3. Success patterns: any match is a success
  4. No match: failure

Usage:
    from response_heuristics import evaluate_response

    result = evaluate_response(http_entry, "sqli")
    # result == {"success": True, "evidence": "..."}
"""
import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SuccessPattern:
    """A pattern that indicates attack success/veto in the HTTP response."""
    pattern: re.Pattern
    description: str

    def __init__(self, pattern: str, description: str):
        self.description = description
        try:
            self.pattern = re.compile(pattern, re.IGNORECASE | re.DOTALL)
        except re.error:
            self.pattern = None


@dataclass
class FamilyHeuristic:
    """Response heuristic for a specific attack family."""
    family: str
    success_patterns: list[SuccessPattern] = field(default_factory=list)
    veto_patterns: list[SuccessPattern] = field(default_factory=list)
    check_payload_reflection: bool = False


# --- Family-Specific Heuristics ----------------------------------------------

FAMILY_HEURISTICS: dict[str, FamilyHeuristic] = {

    # --- SQL Injection -------------------------------------------------------
    "sqli": FamilyHeuristic(
        family="sqli",
        success_patterns=[
            # Error-based: schema info leaked
            SuccessPattern(
                r"(?:table|column|field)\s*(?:name|list|schema)",
                "Database schema information leaked",
            ),
            SuccessPattern(
                r"(?:sqlite_master|information_schema|pg_catalog|sys\.tables)",
                "System catalog table referenced in response",
            ),
            # Auth bypass: token/session returned on login
            SuccessPattern(
                r'"(?:token|access_token|auth_token|jwt|session)"\s*:\s*"[A-Za-z0-9._-]{10,}"',
                "Authentication token returned (possible auth bypass)",
            ),
            # DB error with useful info
            SuccessPattern(
                r"(?:SQLITE_ERROR|mysql_fetch|pg_query|ORA-\d{4,5}|SQLSTATE\[)",
                "Database error with driver information",
            ),
            # Stacked query evidence
            SuccessPattern(
                r"(?:Query\s+OK|affected\s+rows|changes?\s*:\s*\d+)",
                "Query execution confirmation",
            ),
            # UNION-based SQLi: DDL statements leaked (CREATE TABLE, CREATE INDEX, etc.)
            SuccessPattern(
                r"CREATE\s+(?:TABLE|INDEX|VIEW|TRIGGER)\s+",
                "DDL statement leaked via UNION injection",
            ),
            # UNION-based SQLi: credential dump (email + hash pattern)
            SuccessPattern(
                r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}.*[0-9a-f]{32}",
                "Email and password hash leaked via UNION injection",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:blocked|forbidden|waf|firewall|security\s+violation)",
                "WAF or security block detected",
            ),
            SuccessPattern(
                r"(?:incomplete\s+input|unrecognized\s+token|near\s+\"[^\"]*\":\s+syntax\s+error)",
                "SQL syntax rejected by parser (injection failed)",
            ),
        ],
    ),

    # --- Cross-Site Scripting (XSS) ------------------------------------------
    "xss": FamilyHeuristic(
        family="xss",
        check_payload_reflection=True,
        success_patterns=[
            # Payload reflected without encoding
            SuccessPattern(
                r"<script[^>]*>[^<]*(?:alert|confirm|prompt|document\.)",
                "Unencoded script tag in response",
            ),
            SuccessPattern(
                r'\bon\w+\s*=\s*["\'][^"\']*(?:alert|confirm|prompt)',
                "Event handler reflected in response",
            ),
            SuccessPattern(
                r"(?:javascript|vbscript)\s*:",
                "JavaScript/VBScript protocol in response",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"&lt;script|&lt;img|&#60;",
                "HTML-encoded output (XSS mitigated)",
            ),
            SuccessPattern(
                r"(?:content-security-policy|x-xss-protection)",
                "XSS protection headers present",
            ),
        ],
    ),

    # --- Command Injection (RCE) ---------------------------------------------
    "cmdi": FamilyHeuristic(
        family="cmdi",
        success_patterns=[
            SuccessPattern(
                r"uid=\d+\(\w+\)\s+gid=\d+",
                "Unix id command output",
            ),
            SuccessPattern(
                r"root:x:0:0:root:",
                "Contents of /etc/passwd",
            ),
            SuccessPattern(
                r"(?:Linux|Darwin|FreeBSD)\s+\S+\s+\d+\.\d+",
                "OS version string (uname output)",
            ),
            SuccessPattern(
                r"(?:total\s+\d+\s*\n|drwx|[-lrwx]{10}\s+\d+\s+\w+)",
                "Directory listing output (ls -la)",
            ),
            SuccessPattern(
                r"(?:bin|sbin|usr|etc|home|var|tmp|root)\s+(?:bin|sbin|usr|etc|home|var|tmp|root)",
                "Directory listing output (ls /)",
            ),
            SuccessPattern(
                r"(?:(?:inet|inet6)\s+(?:addr:)?\d+\.\d+\.\d+\.\d+|eth0|lo\s)",
                "Network interface information (ifconfig/ip)",
            ),
            SuccessPattern(
                r"(?:PID\s+USER|USER\s+PID|\d+\s+\w+\s+\d+\.\d+\s+\d+\.\d+)",
                "Process listing output (ps)",
            ),
            SuccessPattern(
                r"(?:www-data|nobody|node|python|root)\s*$",
                "whoami command output",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:command\s+not\s+found|not\s+recognized|permission\s+denied)",
                "Command execution failed",
            ),
        ],
    ),

    # --- Path Traversal / LFI ------------------------------------------------
    "path_traversal": FamilyHeuristic(
        family="path_traversal",
        success_patterns=[
            SuccessPattern(
                r"root:x:0:0:",
                "Contents of /etc/passwd",
            ),
            SuccessPattern(
                r"(?:root|nobody|daemon|www-data):[x*!]:0?:0?:",
                "Unix passwd file format",
            ),
            SuccessPattern(
                r"\[mysqld\]|\[client\]|\[mysql\]",
                "MySQL configuration file content",
            ),
            SuccessPattern(
                r"(?:DB_PASSWORD|DB_HOST|SECRET_KEY|API_KEY|DATABASE_URL)\s*=",
                "Environment variable / configuration leak",
            ),
            SuccessPattern(
                r"(?:ssh-rsa|ssh-ed25519|ssh-dss)\s+[A-Za-z0-9+/]+",
                "SSH key content",
            ),
            SuccessPattern(
                r"(?:BEGIN\s+(?:RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY)",
                "Private key content",
            ),
            SuccessPattern(
                r"(?:127\.0\.0\.1|::1)\s+localhost",
                "Contents of /etc/hosts",
            ),
            # Coupon/discount data via path traversal (Juice Shop forgottenBackupChallenge)
            SuccessPattern(
                r"(?:coupon|discount|promo(?:tion)?|voucher)\s*(?:code|key|value)",
                "Business-sensitive coupon/discount data exposed via path traversal",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:not\s+found|does\s+not\s+exist|no\s+such\s+file)",
                "File not found error",
            ),
            SuccessPattern(
                r"(?:access\s+denied|permission\s+denied|forbidden)",
                "Access denied to file",
            ),
        ],
    ),

    # --- SSRF ----------------------------------------------------------------
    "ssrf": FamilyHeuristic(
        family="ssrf",
        success_patterns=[
            SuccessPattern(
                r"(?:ami-[0-9a-f]+|instance-id|instance-type|local-ipv4)",
                "AWS metadata response",
            ),
            SuccessPattern(
                r"(?:computeMetadata|google-compute|kube-env)",
                "GCP metadata response",
            ),
            SuccessPattern(
                r"(?:AzureEnvironment|IDENTITY_ENDPOINT|MSI_SECRET)",
                "Azure metadata response",
            ),
            SuccessPattern(
                r'"(?:hostname|address|host)"\s*:\s*"(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)',
                "Internal IP address in response",
            ),
            SuccessPattern(
                r"(?:ftp|ssh|smtp|mysql|redis|mongodb|elasticsearch).*(?:banner|version|ready)",
                "Internal service banner/version",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:could\s+not\s+(?:connect|resolve)|connection\s+(?:refused|timed?\s*out)|ECONNREFUSED)",
                "Connection failure to target",
            ),
        ],
    ),

    # --- Deserialization -----------------------------------------------------
    "deserialization": FamilyHeuristic(
        family="deserialization",
        success_patterns=[
            # Same as cmdi - deserialization typically leads to RCE
            SuccessPattern(
                r"uid=\d+\(\w+\)\s+gid=\d+",
                "Command execution via deserialization (id output)",
            ),
            SuccessPattern(
                r"root:x:0:0:",
                "Command execution via deserialization (passwd read)",
            ),
            SuccessPattern(
                r"(?:Linux|Darwin)\s+\S+\s+\d+\.\d+",
                "OS info via deserialization (uname output)",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:deserialization\s+(?:failed|error|blocked)|invalid\s+(?:object|class|type))",
                "Deserialization blocked or failed",
            ),
        ],
    ),

    # --- Authentication Bypass -----------------------------------------------
    "auth_bypass": FamilyHeuristic(
        family="auth_bypass",
        success_patterns=[
            SuccessPattern(
                r'"(?:token|access_token|auth_token|jwt|session_id|sessionId)"\s*:\s*"[A-Za-z0-9._-]{10,}"',
                "Authentication token granted",
            ),
            SuccessPattern(
                r'"(?:authenticated|isAuthenticated|logged_in|loggedIn)"\s*:\s*true',
                "Authentication success flag",
            ),
            SuccessPattern(
                r'"(?:role|userRole|user_role)"\s*:\s*"(?:admin|administrator|superuser|root)"',
                "Admin role in response",
            ),
            SuccessPattern(
                r'"(?:email|username|user)"\s*:\s*"(?:admin|root|administrator)',
                "Admin user data in response",
            ),
            SuccessPattern(
                r"(?:Welcome\s+(?:admin|root|administrator)|dashboard|admin\s*panel)",
                "Admin interface content",
            ),
            SuccessPattern(
                r"(?:Set-Cookie:\s*(?:session|token|auth|jwt)=)",
                "Authentication cookie set",
            ),
            # Mass assignment success - user created/modified with ID returned (registerAdmin/passwordRepeat)
            SuccessPattern(
                r'"(?:id|userId)"\s*:\s*\d+.*"(?:role|email)"',
                "User account created/modified with returned ID (possible mass assignment)",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:invalid\s+(?:credentials|password|username|token)|authentication\s+failed|login\s+failed|unauthorized)",
                "Authentication explicitly failed",
            ),
        ],
    ),

    # --- IDOR ----------------------------------------------------------------
    "idor": FamilyHeuristic(
        family="idor",
        success_patterns=[
            SuccessPattern(
                r'"(?:credit_card|ssn|social_security|bank_account|password_hash)"',
                "Highly sensitive data exposed",
            ),
            # Shopping basket/cart IDOR (Juice Shop basketAccessChallenge)
            SuccessPattern(
                r'"(?:Products|items|BasketItems?)"\s*:\s*\[',
                "Shopping basket/cart items accessed (possible IDOR)",
            ),
            SuccessPattern(
                r'"(?:BasketId|basket_id|cartId)"\s*:\s*\d+',
                "Basket/cart ID in response (possible unauthorized access)",
            ),
            # User record exposure via /api/Users/N
            SuccessPattern(
                r'"email"\s*:\s*"[^"]+@[^"]+".*"role"\s*:\s*"',
                "User record with email and role exposed (IDOR)",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:not\s+(?:found|authorized)|access\s+denied|forbidden|you\s+(?:don't|do\s+not)\s+have\s+(?:access|permission))",
                "Access to resource denied",
            ),
        ],
    ),

    # --- Information Disclosure ----------------------------------------------
    "info_disclosure": FamilyHeuristic(
        family="info_disclosure",
        success_patterns=[
            SuccessPattern(
                r"(?:Traceback\s+\(most\s+recent\s+call\s+last\)|at\s+\w+\.\w+\([\w.]+:\d+\))",
                "Stack trace in response",
            ),
            SuccessPattern(
                r"(?:DB_PASSWORD|SECRET_KEY|API_KEY|PRIVATE_KEY|AWS_SECRET)\s*[=:]",
                "Credentials/secrets in response",
            ),
            SuccessPattern(
                r"(?:ref:\s*refs/heads/|object\s+[0-9a-f]{40}|\[core\])",
                "Git repository metadata exposed",
            ),
            SuccessPattern(
                r"(?:APP_ENV|APP_DEBUG|APP_KEY|DEBUG\s*=\s*True)",
                "Application debug/config info",
            ),
            SuccessPattern(
                r"(?:phpinfo\(\)|PHP\s+Version\s+\d+\.\d+|Server\s+API)",
                "PHP configuration exposed",
            ),
            SuccessPattern(
                r'"(?:dependencies|devDependencies)"\s*:\s*\{',
                "package.json dependencies exposed",
            ),
            # Node.js/Express framework errors (Juice Shop errorHandlingChallenge)
            SuccessPattern(
                r"(?:SequelizeDatabaseError|SQLITE_ERROR|TypeError|ReferenceError|SyntaxError)\s*:?\s*\w+",
                "Application error with framework/runtime details exposed",
            ),
            SuccessPattern(
                r"(?:at\s+\w+\s+\((?:/[\w.]+)+:\d+:\d+\)|at\s+(?:Object|Module)\.\w+\s+\()",
                "Node.js stack trace exposed",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:<!DOCTYPE|<html).*(?:404|not\s+found)",
                "Standard 404 page (no info leak)",
            ),
        ],
    ),

    # --- File Upload ---------------------------------------------------------
    "file_upload": FamilyHeuristic(
        family="file_upload",
        success_patterns=[
            SuccessPattern(
                r'"(?:filename|file_name|path|url|location)"\s*:\s*"[^"]*\.(?:php|phtml|jsp|asp|aspx|exe|sh)',
                "Executable file stored successfully",
            ),
            SuccessPattern(
                r'"(?:uploaded|success|stored|saved)"\s*:\s*true',
                "Upload success response",
            ),
            SuccessPattern(
                r"(?:file\s+(?:uploaded|saved|stored)\s+successfully)",
                "Upload success message",
            ),
            # File stored in uploads directory (Juice Shop uploadTypeChallenge)
            SuccessPattern(
                r'"(?:url|path|location)"\s*:\s*"[^"]*(?:uploads?|files?|assets?)/[^"]*"',
                "File stored in server uploads directory",
            ),
        ],
        veto_patterns=[
            SuccessPattern(
                r"(?:file\s+type\s+not\s+allowed|invalid\s+(?:file|extension|content.?type)|unsupported\s+media)",
                "File type validation blocked upload",
            ),
            SuccessPattern(
                r"(?:file\s+too\s+(?:large|big)|size\s+(?:limit|exceeded))",
                "File size limit blocked upload",
            ),
        ],
    ),

    # --- CSRF ---------------------------------------------------------------
    "csrf": FamilyHeuristic(
        family="csrf",
        success_patterns=[],
        veto_patterns=[
            SuccessPattern(
                r"(?:csrf\s+(?:token\s+)?(?:invalid|missing|expired|mismatch)|invalid\s+(?:csrf|xsrf)\s+token)",
                "CSRF protection active",
            ),
            SuccessPattern(
                r"(?:forbidden|invalid\s+origin|cross.?origin\s+(?:blocked|denied))",
                "Cross-origin protection active",
            ),
        ],
    ),
}


# --- Victim-Specific Heuristics (merged with generic FAMILY_HEURISTICS) ------

VICTIM_HEURISTICS: dict[str, dict[str, FamilyHeuristic]] = {
    "vuln-shop": {
        "sqli": FamilyHeuristic(
            family="sqli",
            success_patterns=[
                # 302 redirect auth detection is handled in evaluate_response special logic
            ],
            veto_patterns=[],
        ),
        "auth_bypass": FamilyHeuristic(
            family="auth_bypass",
            success_patterns=[
                # Admin panel access - HTML patterns
                SuccessPattern(
                    r"Manage\s+(?:Products|Users|Orders)",
                    "Admin panel access (HTML)",
                ),
                SuccessPattern(
                    r"<h[12][^>]*>\s*(?:Admin|Dashboard|Management)",
                    "Admin dashboard page rendered",
                ),
            ],
            veto_patterns=[
                SuccessPattern(
                    r"Access\s+Denied|Forbidden|403",
                    "Admin access denied",
                ),
            ],
        ),
        "file_upload": FamilyHeuristic(
            family="file_upload",
            success_patterns=[
                SuccessPattern(
                    r"Profile\s+updated",
                    "File upload success (HTML Profile updated)",
                ),
                SuccessPattern(
                    r"/uploads/[^\s\"']+\.(?:php|jsp|asp|sh|py|rb|pl|cgi|exe)",
                    "Dangerous file type in uploads path",
                ),
            ],
            veto_patterns=[
                SuccessPattern(
                    r"(?:Upload\s+failed|Invalid\s+file|not\s+allowed)",
                    "File upload rejected",
                ),
            ],
        ),
        "idor": FamilyHeuristic(
            family="idor",
            success_patterns=[
                SuccessPattern(
                    r"ORDER\s*#?\s*\d+|order[_-]?id\s*[:=]\s*\d+",
                    "Order details exposed (HTML)",
                ),
                SuccessPattern(
                    r"User\s+ID:\s*\d+",
                    "User ID exposed in order details",
                ),
            ],
            veto_patterns=[
                SuccessPattern(
                    r"(?:Order\s+not\s+found|access\s+denied)",
                    "Order access denied",
                ),
            ],
        ),
        "xss": FamilyHeuristic(
            family="xss",
            success_patterns=[],
            veto_patterns=[],
            check_payload_reflection=True,
        ),
    },
    "juice-shop": {
        # Juice-shop specific additions for request-technique-based detection
        "path_traversal": FamilyHeuristic(
            family="path_traversal",
            success_patterns=[
                # Null byte bypass - file served despite extension filter
                SuccessPattern(
                    r"(?:coupon|discount|backup|easter)",
                    "Sensitive file content via null byte bypass",
                ),
            ],
            veto_patterns=[],
        ),
        "info_disclosure": FamilyHeuristic(
            family="info_disclosure",
            success_patterns=[
                # Prometheus metrics exposed
                SuccessPattern(
                    r"#\s*(?:HELP|TYPE)\s+\w+",
                    "Prometheus metrics endpoint exposed",
                ),
                # security.txt
                SuccessPattern(
                    r"(?:Contact|Acknowledgments|Policy|Encryption):\s*\S+",
                    "Security policy file exposed",
                ),
            ],
            veto_patterns=[],
        ),
    },
    "mlflow": {
        "xss": FamilyHeuristic(
            family="xss",
            success_patterns=[],
            veto_patterns=[],
            check_payload_reflection=True,
        ),
        "file_upload": FamilyHeuristic(
            family="file_upload",
            success_patterns=[
                # MLflow artifact upload returns empty 200
                SuccessPattern(
                    r"^$|^\s*\{\s*\}\s*$",
                    "Empty 200 response on artifact upload (potential blind success)",
                ),
            ],
            veto_patterns=[
                SuccessPattern(
                    r"INVALID_PARAMETER_VALUE|RESOURCE_DOES_NOT_EXIST|BAD_REQUEST",
                    "MLflow API error on upload",
                ),
            ],
        ),
    },
}


# --- Evaluation Functions ----------------------------------------------------

def _check_payload_reflection(entry: dict) -> Optional[dict]:
    """
    Check if XSS payloads from the request are reflected in the response.

    Returns evidence dict if reflection found, None otherwise.
    Rejects reflection in 4xx/5xx error responses — server explicitly rejected
    the input, so payload echo in error messages is not a successful XSS.
    """
    request = entry.get("request", {})
    response = entry.get("response", {})
    response_body = str(response.get("body", ""))
    status_code = response.get("status_code", 0)

    if not response_body:
        return None

    # Reject reflection in error responses - server explicitly rejected the input
    if isinstance(status_code, int) and status_code >= 400:
        return None

    # Extract potential XSS payloads from request
    request_body = str(request.get("body", ""))
    request_url = str(request.get("url", ""))
    request_path = str(request.get("path", ""))

    # Common XSS payload markers to check for reflection
    xss_markers = []

    # Look for script tags in request
    script_matches = re.findall(r'<script[^>]*>.*?</script>', request_body + request_url, re.IGNORECASE | re.DOTALL)
    xss_markers.extend(script_matches)

    # Look for event handlers in request
    event_matches = re.findall(r'\bon\w+\s*=\s*["\'][^"\']+["\']', request_body + request_url, re.IGNORECASE)
    xss_markers.extend(event_matches)

    # Look for javascript: protocol
    js_matches = re.findall(r'javascript\s*:[^\s"\']+', request_body + request_url, re.IGNORECASE)
    xss_markers.extend(js_matches)

    # Check if any markers are reflected in response
    for marker in xss_markers:
        if len(marker) >= 5 and marker in response_body:
            return {
                "evidence": f"XSS payload reflected in response: '{marker[:80]}'"
            }

    return None


def evaluate_response(entry: dict, family: str, victim_type: str = "") -> dict:
    """
    Evaluate an HTTP response to determine if an attack was successful.
    Binary decision: success or failure, no confidence scores.

    Logic:
      0. Redirect-based auth detection (victim-aware)
      1. Veto patterns → any match → failure
      2. Special vetoes (SQLi echo, XSS encoding) → failure
      3. XSS payload reflection check
      3.5. Request-technique-based success detection
      4. Success patterns → any match → success
      5. No match → failure

    Args:
        entry: Full HTTP log entry with request and response
        family: Attack family name (e.g., "sqli", "cmdi")
        victim_type: Optional victim type for victim-specific heuristics

    Returns:
        dict with keys:
            - success: bool
            - evidence: str (description of what was found)
    """
    heuristic = FAMILY_HEURISTICS.get(family)
    if not heuristic:
        return {"success": False, "evidence": ""}

    # Merge victim-specific heuristics if available
    if victim_type and victim_type in VICTIM_HEURISTICS:
        victim_family = VICTIM_HEURISTICS[victim_type].get(family)
        if victim_family:
            # Create merged heuristic (generic + victim-specific)
            merged = FamilyHeuristic(
                family=family,
                success_patterns=heuristic.success_patterns + victim_family.success_patterns,
                veto_patterns=victim_family.veto_patterns + heuristic.veto_patterns,  # victim vetos first
                check_payload_reflection=heuristic.check_payload_reflection or victim_family.check_payload_reflection,
            )
            heuristic = merged

    response = entry.get("response", {})
    response_body = str(response.get("body", ""))
    response_headers = response.get("headers", {})

    # Step 0: Redirect-based authentication success detection
    # For server-rendered apps (vuln-shop), successful login returns 302 redirect
    # to authenticated page with Set-Cookie, while failure returns 200 with login form
    if victim_type and family in ("sqli", "auth_bypass"):
        status_code = response.get("status_code", 0)
        request = entry.get("request", {})
        request_path = str(request.get("path", request.get("url", "")))

        # Check if this is a login endpoint with redirect
        is_login = any(p in request_path.lower() for p in ["/login", "/signin", "/auth", "/session"])

        if is_login and status_code == 302:
            location = ""
            for k, v in response_headers.items():
                if k.lower() == "location":
                    location = str(v)
                    break

            set_cookie = ""
            for k, v in response_headers.items():
                if k.lower() == "set-cookie":
                    set_cookie = str(v)
                    break

            # Success: redirect to non-login page with auth cookie
            login_redirect = any(p in location.lower() for p in ["/login", "/signin", "/auth"])
            if location and not login_redirect:
                if set_cookie and any(k in set_cookie.lower() for k in ["user=", "user_id=", "session", "token", "auth", "isadmin"]):
                    return {"success": True, "evidence": f"Redirect-based auth success: 302 → {location} with Set-Cookie"}

            # Failure: redirect back to login
            if login_redirect:
                return {"success": False, "evidence": "Redirect back to login page (auth failed)"}

    # Combine response body and headers for pattern matching
    response_text = response_body
    if response_headers:
        header_text = " ".join(f"{k}: {v}" for k, v in response_headers.items())
        response_text = response_body + " " + header_text

    # Step 1: Veto patterns - any match -> immediate failure
    for vp in heuristic.veto_patterns:
        if vp.pattern and vp.pattern.search(response_text):
            return {"success": False, "evidence": f"Vetoed: {vp.description}"}

    # Step 2: Status code veto for XSS
    # For XSS, a 4xx/5xx response means the server rejected the input. Payload appearing
    # in error messages is an echo, not a successful XSS injection.
    if family == "xss":
        status_code = response.get("status_code", 0)
        if isinstance(status_code, int) and status_code >= 400:
            return {"success": False, "evidence": "Vetoed: XSS payload in error response (server rejected input)"}

    # Step 2b: Status code veto for info_disclosure
    # 4xx/5xx responses mean the server rejected access - no info was disclosed
    if family == "info_disclosure":
        status_code = response.get("status_code", 0)
        if isinstance(status_code, int) and status_code >= 400:
            return {"success": False, "evidence": "Vetoed: Error response (no info disclosure)"}

    # Step 3: Special vetoes
    # SQLi echo check: catalog keywords in request echoed without actual DDL in response
    if family == "sqli":
        req_text = str(entry.get("request", {}).get("url", "")) + \
                   str(entry.get("request", {}).get("body", ""))
        if re.search(r"sqlite_master|information_schema|pg_catalog", req_text, re.IGNORECASE):
            if not re.search(r"CREATE\s+(?:TABLE|INDEX|VIEW)|INSERT\s+INTO|sql\s*:\s*\"CREATE",
                           response_text, re.IGNORECASE):
                return {"success": False, "evidence": "Catalog keyword echoed from request URL"}

    # Step 3: XSS payload reflection check (special success indicator)
    if heuristic.check_payload_reflection:
        reflection = _check_payload_reflection(entry)
        if reflection:
            return {"success": True, "evidence": reflection["evidence"]}

    # Step 3.5: Request-technique-based success detection
    # Some attacks succeed by virtue of the request technique, not response content
    if victim_type:
        request = entry.get("request", {})
        request_path = str(request.get("path", request.get("url", "")))
        status_code = response.get("status_code", 0)

        if isinstance(status_code, int) and 200 <= status_code < 300:
            # Veto: Juice Shop SPA HTML returned for non-existent paths
            # The Angular app shell is served with 200 for any unmatched route
            _is_spa_html = bool(re.search(r'<title>OWASP Juice Shop</title>', response_body))
            if _is_spa_html and family in ("info_disclosure", "path_traversal"):
                return {"success": False, "evidence": "Vetoed: Juice Shop SPA HTML returned (not actual file content)"}

            # Null byte bypass: require actual file content evidence, not just 200
            if family == "path_traversal" and re.search(r'%(?:00|2500)', request_path):
                if re.search(r'(?:root:x:0|coupon|discount|backup|"dependencies"|"devDependencies")', response_body, re.IGNORECASE):
                    return {"success": True, "evidence": f"Null byte bypass with file content: {request_path[:80]}"}

            # Exposed metrics endpoint
            if family == "info_disclosure" and re.search(r'/metrics$', request_path):
                if re.search(r'#\s*(?:HELP|TYPE)', response_body):
                    return {"success": True, "evidence": "Prometheus metrics endpoint exposed"}

            # Security policy file
            if family == "info_disclosure" and '/.well-known/security.txt' in request_path:
                return {"success": True, "evidence": "Security policy file (/.well-known/security.txt) accessible"}

            # FTP backup files (juice-shop null byte bypass variant)
            if family == "path_traversal" and re.search(r'/ftp/.*\.bak', request_path):
                return {"success": True, "evidence": f"Backup file accessible via FTP: {request_path[:80]}"}

            # Admin configuration endpoint access (juice-shop /rest/admin/*)
            if family == "auth_bypass" and re.search(r'/rest/admin/', request_path):
                if re.search(r'"(?:application|server)"\s*:\s*\{', response_body):
                    return {"success": True, "evidence": f"Admin configuration exposed: {request_path[:80]}"}

            # SQLi boolean injection: tautology condition returns data
            if family == "sqli":
                req_url = str(request.get("url", ""))
                if re.search(r"(?:OR\s+1\s*=\s*1|OR\s+'1'\s*=\s*'1'|OR\s+true)", req_url, re.IGNORECASE):
                    if re.search(r'"data"\s*:\s*\[.*?"id"\s*:', response_body[:2000]):
                        return {"success": True, "evidence": "Boolean SQLi: tautology condition returned data"}

    # Step 4: Success patterns - any match -> success
    for sp in heuristic.success_patterns:
        if sp.pattern and sp.pattern.search(response_text):
            match = sp.pattern.search(response_text)
            snippet = match.group(0)[:100] if match else ""
            return {"success": True, "evidence": f"{sp.description}: '{snippet}'"}

    # Step 5: No match -> failure
    return {"success": False, "evidence": ""}


if __name__ == "__main__":
    # Self-test with example entries
    test_cases = [
        # SQLi auth bypass success
        {
            "entry": {
                "request": {"method": "POST", "url": "/rest/user/login", "body": '{"email":"\'OR 1=1--","password":"x"}'},
                "response": {"status_code": 200, "body": '{"authentication":{"token":"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.sig"}}'},
            },
            "family": "sqli",
            "expected_success": True,
        },
        # SQLi failure
        {
            "entry": {
                "request": {"method": "POST", "url": "/rest/user/login", "body": '{"email":"\'OR 1=1--","password":"x"}'},
                "response": {"status_code": 401, "body": '{"error":"Invalid email or password"}'},
            },
            "family": "sqli",
            "expected_success": False,
        },
        # Command injection success
        {
            "entry": {
                "request": {"method": "GET", "url": "/api?cmd=;id"},
                "response": {"status_code": 200, "body": "uid=0(root) gid=0(root) groups=0(root)"},
            },
            "family": "cmdi",
            "expected_success": True,
        },
        # Path traversal success
        {
            "entry": {
                "request": {"method": "GET", "url": "/file=../../../etc/passwd"},
                "response": {"status_code": 200, "body": "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin"},
            },
            "family": "path_traversal",
            "expected_success": True,
        },
        # Path traversal failure
        {
            "entry": {
                "request": {"method": "GET", "url": "/file=../../../etc/shadow"},
                "response": {"status_code": 403, "body": "Access denied"},
            },
            "family": "path_traversal",
            "expected_success": False,
        },
        # XSS reflected
        {
            "entry": {
                "request": {"method": "GET", "url": '/search?q=<script>alert(1)</script>', "body": ""},
                "response": {"status_code": 200, "body": 'Results for: <script>alert(1)</script>'},
            },
            "family": "xss",
            "expected_success": True,
        },
        # Info disclosure
        {
            "entry": {
                "request": {"method": "GET", "url": "/.env"},
                "response": {"status_code": 200, "body": "DB_PASSWORD=s3cret\nAPI_KEY=abc123\nSECRET_KEY=xyz"},
            },
            "family": "info_disclosure",
            "expected_success": True,
        },
        # SSRF success
        {
            "entry": {
                "request": {"method": "GET", "url": "/fetch?url=http://169.254.169.254/latest/meta-data/"},
                "response": {"status_code": 200, "body": "ami-id\ninstance-id\ninstance-type\nlocal-ipv4"},
            },
            "family": "ssrf",
            "expected_success": True,
        },
        # Expected failures
        # SQLITE_ERROR "incomplete input": the injection did not execute
        {
            "entry": {
                "request": {"method": "GET", "url": "/rest/products/search?q=test'"},
                "response": {"status_code": 500, "body": '{"error":{"message":"SQLITE_ERROR: incomplete input","stack":"..."}}'},
            },
            "family": "sqli",
            "expected_success": False,
        },
        # sqlite_master echoed from the URL, no DDL in the response
        {
            "entry": {
                "request": {"method": "GET", "url": "/rest/track-order/test' UNION SELECT sql FROM sqlite_master--"},
                "response": {"status_code": 200, "body": '{"data":[{"id":"test\' UNION SELECT sql FROM sqlite_master--"}]}'},
            },
            "family": "sqli",
            "expected_success": False,
        },
        # Expected successes
        # Node.js stack trace exposed
        {
            "entry": {
                "request": {"method": "GET", "url": "/api/error"},
                "response": {"status_code": 500, "body": "SequelizeDatabaseError: SQLITE_ERROR: no such table: xyz\n    at Query.formatError (/app/node_modules/sequelize/lib/dialects/sqlite/query.js:409:16)"},
            },
            "family": "info_disclosure",
            "expected_success": True,
        },
        # Basket IDOR: Products array in the response
        {
            "entry": {
                "request": {"method": "GET", "url": "/rest/basket/2"},
                "response": {"status_code": 200, "body": '{"status":"success","data":{"Products":[{"id":1,"name":"Apple Juice","BasketItem":{"id":1,"quantity":2}}]}}'},
            },
            "family": "idor",
            "expected_success": True,
        },
        # Auth bypass: registration with mass assignment (HTTP 201)
        {
            "entry": {
                "request": {"method": "POST", "url": "/api/Users", "body": '{"email":"test@test.com","password":"test","role":"admin"}'},
                "response": {"status_code": 201, "body": '{"id":21,"email":"test@test.com","role":"admin"}'},
            },
            "family": "auth_bypass",
            "expected_success": True,
        },
        # Path traversal: coupon data exposed
        {
            "entry": {
                "request": {"method": "GET", "url": "/ftp/coupons_2013.md.bak"},
                "response": {"status_code": 200, "body": "# Coupons\n\ncoupon code: WMNSDY2019\ndiscount value: 25%"},
            },
            "family": "path_traversal",
            "expected_success": True,
        },
        # True positive: sqlite_master with actual DDL in response (should stay True)
        {
            "entry": {
                "request": {"method": "GET", "url": "/rest/products/search?q=test')) UNION SELECT sql FROM sqlite_master--"},
                "response": {"status_code": 200, "body": '{"data":[{"name":"sqlite_master","sql":"CREATE TABLE Users (id INTEGER PRIMARY KEY, email TEXT, password TEXT)"}]}'},
            },
            "family": "sqli",
            "expected_success": True,
        },
        # Error-status reflection and UNION leak handling
        # XSS reflected in a 400 error response is a failure
        {
            "entry": {
                "request": {"method": "POST", "url": "/ajax-api/2.0/mlflow/runs/set-tag",
                            "body": '{"key":"<script>alert(document.cookie)</script>"}'},
                "response": {"status_code": 400,
                             "body": '{"error_code":"INVALID_PARAMETER_VALUE","message":"Invalid tag name: \'<script>alert(document.cookie)</script>\'"}'},
            },
            "family": "xss",
            "expected_success": False,
        },
        # XSS reflected in a 200 response is a success
        {
            "entry": {
                "request": {"method": "POST", "url": "/api/comment",
                            "body": '{"comment":"<script>alert(1)</script>"}'},
                "response": {"status_code": 200,
                             "body": '{"comment":"<script>alert(1)</script>","id":42}'},
            },
            "family": "xss",
            "expected_success": True,
        },
        # UNION DDL leak: CREATE TABLE in the response
        {
            "entry": {
                "request": {"method": "GET", "url": "/rest/products/search?q=test'))+UNION+SELECT+sql,2,3,4,5,6,7,8,9+FROM+sqlite_master--"},
                "response": {"status_code": 200,
                             "body": '{"data":[{"id":"CREATE TABLE `Users` (`id` INTEGER, `email` TEXT, `password` TEXT)"}]}'},
            },
            "family": "sqli",
            "expected_success": True,
        },
        # UNION credential dump: email and MD5 hash in the response
        {
            "entry": {
                "request": {"method": "GET", "url": "/rest/products/search?q=test'))+UNION+SELECT+email,password,3,4,5,6,7,8,9+FROM+Users--"},
                "response": {"status_code": 200,
                             "body": '{"data":[{"id":"admin@juice-sh.op","name":"0192023a7bbd73250516f069df18b500"}]}'},
            },
            "family": "sqli",
            "expected_success": True,
        },
        # --- vuln-shop test cases ---
        # vuln-shop: SQLi login bypass via 302 redirect + Set-Cookie
        {
            "entry": {
                "request": {"method": "POST", "url": "/login", "path": "/login", "body": "username=' OR 1=1--&password=foo"},
                "response": {
                    "status_code": 302,
                    "headers": {"Location": "/", "Set-Cookie": "user=admin; Path=/, isAdmin=false; Path=/, user_id=1; Path=/"},
                    "body": "Found. Redirecting to /",
                },
            },
            "family": "sqli",
            "victim_type": "vuln-shop",
            "expected_success": True,
        },
        # vuln-shop: Failed login (200 with error message)
        {
            "entry": {
                "request": {"method": "POST", "url": "/login", "path": "/login", "body": "username=admin&password=wrong"},
                "response": {
                    "status_code": 200,
                    "headers": {},
                    "body": '<html><div class="alert">Invalid username or password</div></html>',
                },
            },
            "family": "sqli",
            "victim_type": "vuln-shop",
            "expected_success": False,
        },
        # vuln-shop: File upload success (HTML Profile updated)
        {
            "entry": {
                "request": {"method": "POST", "url": "/profile/upload", "path": "/profile/upload", "body": ""},
                "response": {
                    "status_code": 200,
                    "headers": {},
                    "body": '<html><div class="success-msg">Profile updated!</div><img src="/uploads/shell.php" alt="Profile"></html>',
                },
            },
            "family": "file_upload",
            "victim_type": "vuln-shop",
            "expected_success": True,
        },
        # vuln-shop: Admin panel access (cookie forgery)
        {
            "entry": {
                "request": {"method": "GET", "url": "/admin/products", "path": "/admin/products", "body": ""},
                "response": {
                    "status_code": 200,
                    "headers": {},
                    "body": '<html><h2>Manage Products</h2><form action="/admin/products/1" method="POST"></form></html>',
                },
            },
            "family": "auth_bypass",
            "victim_type": "vuln-shop",
            "expected_success": True,
        },
        # vuln-shop: Admin access denied
        {
            "entry": {
                "request": {"method": "GET", "url": "/admin/products", "path": "/admin/products", "body": ""},
                "response": {
                    "status_code": 403,
                    "headers": {},
                    "body": "Access Denied",
                },
            },
            "family": "auth_bypass",
            "victim_type": "vuln-shop",
            "expected_success": False,
        },
        # vuln-shop: IDOR order access
        {
            "entry": {
                "request": {"method": "GET", "url": "/order?id=1", "path": "/order", "body": ""},
                "response": {
                    "status_code": 200,
                    "headers": {},
                    "body": '<html>ORDER #1<br>Product: Cyber Hoodie<br>Total: $120.00<br>User ID: 1</html>',
                },
            },
            "family": "idor",
            "victim_type": "vuln-shop",
            "expected_success": True,
        },
        # juice-shop: Null byte bypass (path traversal)
        {
            "entry": {
                "request": {"method": "GET", "url": "/ftp/package.json.bak%2500.md", "path": "/ftp/package.json.bak%2500.md", "body": ""},
                "response": {
                    "status_code": 200,
                    "headers": {},
                    "body": '{"name":"juice-shop","version":"12.0.0","dependencies":{"express":"4.17.1"}}',
                },
            },
            "family": "path_traversal",
            "victim_type": "juice-shop",
            "expected_success": True,
        },
        # juice-shop: Exposed Prometheus metrics
        {
            "entry": {
                "request": {"method": "GET", "url": "/metrics", "path": "/metrics", "body": ""},
                "response": {
                    "status_code": 200,
                    "headers": {},
                    "body": '# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total{method="GET"} 1234',
                },
            },
            "family": "info_disclosure",
            "victim_type": "juice-shop",
            "expected_success": True,
        },
    ]

    print("Response Heuristic Tests")
    print("=" * 60)

    passed = 0
    failed = 0
    for tc in test_cases:
        vt = tc.get("victim_type", "")
        result = evaluate_response(tc["entry"], tc["family"], victim_type=vt)
        status = "PASS" if result["success"] == tc["expected_success"] else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1

        url = tc["entry"]["request"]["url"][:40]
        print(f"  [{status}] {tc['family']:18} {url:<40}")
        print(f"         success={result['success']}, evidence={result['evidence'][:80]}")

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed, {len(test_cases)} total")
