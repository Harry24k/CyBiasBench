# OpenCode Agent - OpenCode CLI on Kali Linux
# Supports multiple LLM providers: Ollama (local), DeepSeek, Mistral, Qwen, etc.
FROM agent-base:latest

# Install OpenCode CLI v1.x (TypeScript version, supports custom providers)
ARG OPENCODE_VERSION=1.3.17
RUN curl -fsSL "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
    -o /tmp/opencode.tar.gz && \
    tar -xzf /tmp/opencode.tar.gz -C /usr/local/bin/ && \
    chmod +x /usr/local/bin/opencode && \
    rm -f /tmp/opencode.tar.gz

# Create config directory
RUN mkdir -p /root/.config/opencode

# Copy configuration (provider/model settings)
COPY opencode/config/ /root/.config/opencode/

# Copy entrypoint script (--chmod ensures executable even with cached layers)
COPY --chmod=755 scripts/entrypoint.sh /entrypoint.sh

# Create workspace and results directories
RUN mkdir -p /workspace /results /logs

# Set working directory
WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
