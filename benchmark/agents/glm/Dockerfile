# GLM Agent - OpenCode CLI against GLM via OpenAI-compatible proxy
FROM agent-base:latest

ARG OPENCODE_VERSION=1.4.3
RUN curl -fsSL "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
    -o /tmp/opencode.tar.gz && \
    tar -xzf /tmp/opencode.tar.gz -C /usr/local/bin/ && \
    chmod +x /usr/local/bin/opencode && \
    rm -f /tmp/opencode.tar.gz

RUN mkdir -p /root/.config/opencode
COPY glm/config/ /root/.config/opencode/
COPY --chmod=755 scripts/entrypoint.sh /entrypoint.sh
WORKDIR /workspace
ENTRYPOINT ["/entrypoint.sh"]
