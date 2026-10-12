#!/bin/bash
set -e

# Common entrypoint for all agent containers. Waits for the metrics proxy
# and the victim to be reachable, then dispatches to the per-agent CLI
# command. All API traffic is intercepted by the LiteLLM proxy
# (see metrics/custom_logger.py) and recorded to /app/logs/usage.jsonl,
# which run.sh extracts as api-logs/usage.jsonl in the session directory.

PROMPT_FILE="${PROMPT_FILE:-/prompts/attack.txt}"
OUTPUT_MODE="${OUTPUT_MODE:-report}"
AGENT_TYPE="${AGENT_TYPE:-unknown}"
VICTIM_HOST="${VICTIM_HOST:-victim}"
VICTIM_PORT="${VICTIM_PORT:-3000}"

if [[ -z "$OUTPUT_FORMAT_FILE" ]]; then
    if [[ "$OUTPUT_MODE" == "struct" ]]; then
        OUTPUT_FORMAT_FILE="/output_formats/example_struct.txt"
    else
        OUTPUT_FORMAT_FILE="/output_formats/example_report.txt"
    fi
fi

OUTPUT_EXT=$([[ "$OUTPUT_MODE" == "struct" ]] && echo "jsonl" || echo "md")
RESULT_FILE="/results/${AGENT_TYPE}.${OUTPUT_EXT}"

echo "Agent:   $AGENT_TYPE"
echo "Mode:    $OUTPUT_MODE  (template: $OUTPUT_FORMAT_FILE)"
echo "Victim:  http://${VICTIM_HOST}:${VICTIM_PORT}"
echo "Result:  $RESULT_FILE"

if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "ERROR: Prompt file not found: $PROMPT_FILE"
    exit 1
fi
if [[ ! -f "$OUTPUT_FORMAT_FILE" ]]; then
    echo "ERROR: Output format file not found: $OUTPUT_FORMAT_FILE"
    exit 1
fi

PROMPT="Target: http://${VICTIM_HOST}:${VICTIM_PORT}

$(cat "$PROMPT_FILE")"

FORMAT_INSTRUCTION=$(sed "s|{{RESULT_FILE}}|${RESULT_FILE}|g" "$OUTPUT_FORMAT_FILE")
FULL_PROMPT="${PROMPT}

${FORMAT_INSTRUCTION}"

# Wait for the metrics proxy. Without it, API calls bypass token tracking
# and the run is unrecoverable for cost/efficiency analysis.
PROXY_URL="${ANTHROPIC_BASE_URL:-${OPENAI_BASE_URL:-${GOOGLE_GEMINI_BASE_URL:-$KIMI_BASE_URL}}}"
if [[ -n "$PROXY_URL" ]]; then
    echo "Waiting for metrics proxy at $PROXY_URL..."
    for i in $(seq 1 30); do
        if curl -sf "${PROXY_URL}/health" > /dev/null 2>&1; then
            echo "Metrics proxy ready."
            break
        fi
        [[ $i -eq 30 ]] && echo "WARNING: proxy unreachable after 60s; continuing without metrics"
        sleep 2
    done
fi

# Wait for the victim. Compose's depends_on only guarantees the container
# started, not that the inner web server has bound its port - slow targets
# (mlflow, gradio) routinely take ~10s after container start.
echo "Waiting for victim..."
for i in $(seq 1 30); do
    if curl -sf "http://${VICTIM_HOST}:${VICTIM_PORT}" > /dev/null 2>&1; then
        echo "Victim ready."
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "ERROR: victim unreachable after 60s"
        exit 1
    fi
    sleep 2
done

mkdir -p /results
touch "$RESULT_FILE"

set +e
case "$AGENT_TYPE" in
    codex)
        echo "$OPENAI_API_KEY" | codex login --with-api-key
        OUTPUT=$(codex exec --model "${CODEX_MODEL:-gpt-5.2-codex}" --yolo --skip-git-repo-check "$FULL_PROMPT" 2>&1)
        EXIT_CODE=$?
        ;;
    claude)
        OUTPUT=$(claude --model "${CLAUDE_MODEL:-claude-opus-4-5-20251101}" --print --dangerously-skip-permissions "$FULL_PROMPT" 2>&1)
        EXIT_CODE=$?
        ;;
    gemini)
        OUTPUT=$(gemini --model "${GEMINI_MODEL:-gemini-2.5-pro}" -p "$FULL_PROMPT" --yolo --include-directories /results 2>&1)
        EXIT_CODE=$?
        ;;
    opencode)
        OUTPUT=$(opencode run --dangerously-skip-permissions --dir /results -m "${OPENCODE_MODEL}" "$FULL_PROMPT" 2>&1)
        EXIT_CODE=$?
        ;;
    glm)
        # GLM is reached through OpenCode talking to the LiteLLM proxy's
        # OpenAI-compatible endpoint; the litellm-glm/ prefix selects the
        # provider entry in opencode.json.
        GLM_MODEL_NAME="${GLM_MODEL:-glm-5.1}"
        GLM_MODEL_NAME="${GLM_MODEL_NAME#litellm-glm/}"
        OUTPUT=$(opencode run --dangerously-skip-permissions --dir /results -m "litellm-glm/${GLM_MODEL_NAME}" "$FULL_PROMPT" 2>&1)
        EXIT_CODE=$?
        ;;
    kimi)
        # Kimi CLI reads provider/model from ~/.kimi/config.toml; generate
        # one that points at the metrics proxy instead of api.moonshot.cn.
        mkdir -p /root/.kimi
        KIMI_MODEL_NAME="${KIMI_MODEL:-kimi-k2.5}"
        cat > /root/.kimi/config.toml <<KIMI_EOF
default_model = "current"
default_yolo = true

[providers.proxy]
type = "kimi"
base_url = "${KIMI_BASE_URL:-http://metrics-proxy:4000}"
api_key = "${KIMI_API_KEY:-unused}"

[models.current]
provider = "proxy"
model = "${KIMI_MODEL_NAME}"
max_context_size = 262144
KIMI_EOF
        OUTPUT=$(kimi --yolo -p "$FULL_PROMPT" 2>&1)
        EXIT_CODE=$?
        ;;
    *)
        echo "ERROR: Unknown agent type: $AGENT_TYPE"
        exit 1
        ;;
esac
set -e

# The metrics proxy returns HTTP 429 with "limit_exceeded" once a configured
# token/call cap is reached. Treat that as intentional clean termination.
if echo "$OUTPUT" | grep -q "limit_exceeded"; then
    echo "Limit reached; agent terminated gracefully."
    echo "$OUTPUT"
    exit 0
fi

echo "$OUTPUT"

if [[ ! -s "$RESULT_FILE" ]]; then
    echo "[Fallback] Agent did not write to file, saving stdout..."
    echo "$OUTPUT" > "$RESULT_FILE"
fi

if [[ $EXIT_CODE -ne 0 ]]; then
    echo "Agent exited with code: $EXIT_CODE"
    exit $EXIT_CODE
fi

echo "Done. Result: $RESULT_FILE"
