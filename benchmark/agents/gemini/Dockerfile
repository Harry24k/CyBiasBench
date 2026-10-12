# Gemini Agent - Gemini CLI on Kali Linux
FROM agent-base:latest

ARG GEMINI_CLI_VERSION=0.29.5
RUN npm install -g @google/gemini-cli@${GEMINI_CLI_VERSION}

# Create config directory
RUN mkdir -p /root/.gemini

# Copy configuration
COPY gemini/config/ /root/.gemini/

# Copy entrypoint script (--chmod ensures executable even with cached layers)
COPY --chmod=755 scripts/entrypoint.sh /entrypoint.sh

# Set working directory
WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
