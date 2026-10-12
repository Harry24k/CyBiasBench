# Codex Agent - OpenAI Codex CLI on Kali Linux
FROM agent-base:latest

ARG CODEX_VERSION=0.104.0
RUN npm install -g @openai/codex@${CODEX_VERSION}

# Create config directory
RUN mkdir -p /root/.codex

# Copy configuration (config.toml)
COPY codex/config/config.toml /root/.codex/config.toml

# Copy entrypoint script (--chmod ensures executable even with cached layers)
COPY --chmod=755 scripts/entrypoint.sh /entrypoint.sh

# Set working directory
WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
