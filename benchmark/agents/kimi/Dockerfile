# Kimi Agent - Kimi Code CLI on Kali Linux
FROM agent-base:latest

ARG KIMI_CLI_VERSION=1.30.0
RUN pip install --break-system-packages kimi-cli==${KIMI_CLI_VERSION}

# Create config directory (config.toml generated at runtime by entrypoint)
RUN mkdir -p /root/.kimi

# Copy entrypoint script (--chmod ensures executable even with cached layers)
COPY --chmod=755 scripts/entrypoint.sh /entrypoint.sh

# Set working directory
WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
