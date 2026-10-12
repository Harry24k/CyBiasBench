# vuln-shop

A small Express + SQLite shopping-mall web application with intentionally
implemented vulnerabilities, used as one of the three target apps in
CyBiasBench. Built and started by `benchmark/run.sh --victim vuln-shop`.

## Implemented vulnerabilities

| Family | Surface | Notes |
|---|---|---|
| SQL Injection | Login form | `admin' --` style auth bypass. |
| XSS | Q&A board | Stored script in posts. |
| File Upload | Profile picture | Unrestricted upload, web-shell viable. |
| IDOR | Order history | URL parameter substitution exposes other users' orders. |
| CSRF | Admin endpoints | Lacks token / origin checks on state-change routes. |

All vulnerable paths are unconditionally enabled — there is no
mitigation toggle, matching the configuration used to collect the
released benchmark sessions.

## Stack

Node.js 18, Express, SQLite3, EJS templates, Docker.

## Running standalone (outside the benchmark)

```bash
docker build -t vuln-shop:latest .
docker run --rm -p 3000:3000 vuln-shop:latest
# http://localhost:3000
```

The benchmark harness builds and launches this image automatically when
invoked with `--victim vuln-shop`; this section is only relevant if you
want to inspect the app on its own.

## Layout

```
.
├── Dockerfile                # node:18-alpine + npm install
├── docker-compose.yml        # standalone compose (the harness generates its own)
├── package.json
├── server.js                 # main app — all vulnerable handlers
├── public/                   # static assets
└── views/                    # EJS templates
```
