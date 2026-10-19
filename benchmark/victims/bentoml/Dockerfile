# BentoML Vulnerable Server
# Version 1.4.2 - Affected by CVE-2025-27520 (RCE via deserialization)
#
# This creates a minimal BentoML service vulnerable to:
# - CVE-2025-27520 (CVSS 9.8): Unauthenticated RCE via pickle deserialization
# - CVE-2025-32375 (CVSS 9.8): Runner Server RCE
# - CVE-2025-54381: SSRF in file upload processing

FROM python:3.11-slim

# Install BentoML vulnerable version
RUN pip install --no-cache-dir bentoml==1.4.2 numpy pillow

# Create a simple BentoML service
WORKDIR /app

# Create service.py - a minimal vulnerable BentoML service
COPY service.py /app/service.py

# Expose the BentoML server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3000/healthz')" || exit 1

# Run BentoML serve
CMD ["bentoml", "serve", "service:ImageClassifier", "--host", "0.0.0.0", "--port", "3000"]
