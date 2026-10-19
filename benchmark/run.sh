#!/bin/bash
# --- AI Agent Attack Automation - Main Script --------------------------------
# Usage: ./run.sh --prompt <file> --agent <type> [options]
#
# Each invocation runs exactly ONE agent in an isolated environment.
# For parallel experiments, run multiple ./run.sh in separate terminals -
# each session gets a unique Docker network/containers, so no conflicts.

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROMPT_FILE=""
AGENT_TYPE=""
MODE="report"
OUTPUT_FORMAT_FILE=""
KEEP_CONTAINERS=false
BUILD_IMAGES=false
VICTIM_TYPE="juice-shop"
CUSTOM_VICTIM_PORT=""

# Execution limits (0 = unlimited)
TOKEN_LIMIT=0
CALL_LIMIT=0

# Model selection (defaults)
CLAUDE_MODEL="claude-opus-4-5-20251101"
CODEX_MODEL="gpt-5.2-codex"
GEMINI_MODEL="gemini-2.5-pro"
KIMI_MODEL="kimi-k2.5"
GLM_MODEL="glm-5.1"
OPENCODE_MODEL=""

# Model CLI override flags
CLAUDE_MODEL_CLI_SET=""
CODEX_MODEL_CLI_SET=""
GEMINI_MODEL_CLI_SET=""
KIMI_MODEL_CLI_SET=""
GLM_MODEL_CLI_SET=""
OPENCODE_MODEL_CLI_SET=""

# Rerun mode
RERUN_SESSION=""

# Explicit session suffix (e.g. "01"). When set, reserve_session_timestamp
# uses this value instead of auto-incrementing, so parallel launchers can
# pin each job to its matrix slot.
SESSION_SUFFIX=""

# Generated compose file (set by generate_compose)
COMPOSE_FILE=""
COMPOSE_PROJECT=""

# Per-session temporary prompt file (set only when --prompt is outside ./prompts/)
TEMP_PROMPT_FILE=""

# Container-side path passed to the agent via PROMPT_FILE env var
PROMPT_CONTAINER_PATH=""

# Print colored message
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Docker compose wrapper (always uses generated compose file + project name)
dc() {
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" "$@"
}

# Cleanup on exit. The EXIT trap's last command sets the script's exit
# status, so every branch ends with a command that returns 0.
cleanup_on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 && -n "$COMPOSE_FILE" && -f "$COMPOSE_FILE" && -n "$COMPOSE_PROJECT" ]]; then
        log_warn "Abnormal exit (code $exit_code). Cleaning up containers..."
        dc down --remove-orphans 2>/dev/null || true
        rm -f "$COMPOSE_FILE"
    fi
    # Always remove per-session temp prompt (created only for out-of-tree prompts)
    if [[ -n "$TEMP_PROMPT_FILE" && -f "$TEMP_PROMPT_FILE" ]]; then
        rm -f "$TEMP_PROMPT_FILE"
    fi
    return $exit_code
}
trap cleanup_on_exit EXIT

# Create session.json metadata file
create_session_json() {
    local model_value=""
    case "$AGENT_TYPE" in
        claude)   model_value="$CLAUDE_MODEL" ;;
        codex)    model_value="$CODEX_MODEL" ;;
        gemini)   model_value="$GEMINI_MODEL" ;;
        kimi)     model_value="$KIMI_MODEL" ;;
        glm)      model_value="$GLM_MODEL" ;;
        opencode) model_value="$OPENCODE_MODEL" ;;
    esac

    python3 -c "
import json, os

victim_port = int('${VICTIM_PORT}') if '${VICTIM_PORT}'.isdigit() else 3000
token_limit = int('${TOKEN_LIMIT}') if '${TOKEN_LIMIT}'.isdigit() else 0
call_limit = int('${CALL_LIMIT}') if '${CALL_LIMIT}'.isdigit() else 0

prompt_base = os.path.basename('${PROMPT_FILE}')
fmt_raw = '${OUTPUT_FORMAT_FILE}'
fmt_base = os.path.basename(fmt_raw) if fmt_raw else 'default'

session = {
    'session_id': '${SESSION_TIMESTAMP}',
    'created_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'victim': {
        'type': '${VICTIM_TYPE}',
        'image': '${VICTIM_IMAGE}',
        'port': victim_port
    },
    'prompt_file': prompt_base,
    'output_format_file': fmt_base,
    'mode': '${MODE}',
    'limits': {
        'token': token_limit,
        'call': call_limit
    },
    'agents': {
        '${AGENT_TYPE}': {
            'status': 'pending',
            'model': '$model_value',
            'started_at': None,
            'finished_at': None,
            'exit_code': None
        }
    }
}

with open('./${SESSION_DIR}/session.json', 'w') as f:
    json.dump(session, f, indent=2)
"
    log_info "session.json created"
}

# Update agent status in session.json
update_agent_status() {
    local status=$1
    local exit_code=${2:-null}
    local ts
    ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    python3 -c "
import json

path = './${SESSION_DIR}/session.json'
try:
    with open(path) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    exit(0)

agent_key = '${AGENT_TYPE}'
if agent_key not in data.get('agents', {}):
    data.setdefault('agents', {})[agent_key] = {}

a = data['agents'][agent_key]
a['status'] = '$status'
if '$status' == 'running':
    a['started_at'] = '$ts'
elif '$status' in ('completed', 'failed', 'rerun_completed'):
    a['finished_at'] = '$ts'
    ec = '$exit_code'
    a['exit_code'] = int(ec) if ec.isdigit() else None

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
"
}

# Usage information
usage() {
    cat << EOF
${GREEN}AI Agent Attack Automation${NC}
===========================

Usage: $0 --prompt <file> --agent <type> [OPTIONS]

${YELLOW}Required:${NC}
  --prompt <file>           Path to prompt file

${YELLOW}Agent Selection (exactly one required):${NC}
  --agent <type>            Agent type (claude, codex, gemini, kimi, glm, opencode)
  --claude                  Shorthand for --agent claude
  --codex                   Shorthand for --agent codex
  --gemini                  Shorthand for --agent gemini
  --kimi                    Shorthand for --agent kimi
  --glm                     Shorthand for --agent glm
  --opencode                Shorthand for --agent opencode

${YELLOW}Options:${NC}
  --victim <type|image>     Victim server (default: juice-shop)
                            Presets: juice-shop, webgoat, vuln-shop, bentoml, mlflow, gradio
                            Or any Docker image tag (e.g., nginx:latest, myapp:v1)
  --victim-port <port>      Port for custom victim image (default: 3000)
  --mode <report|struct>    Output format (default: report)
  --output-format <file>    Custom output format template file
  --keep                    Keep containers after execution
  --build                   Force rebuild Docker images
  --rerun <session_id>      Re-run an existing session
  --session-suffix <NN>     Pin session number (e.g. "01") instead of auto-increment.
                            Used by parallel launchers to pin matrix slots.
  --help                    Show this help message

${YELLOW}Execution Limits:${NC}
  --token-limit <n>         Max tokens (default: unlimited)
  --call-limit <n>          Max API calls (default: unlimited)

${YELLOW}Model Selection:${NC}
  --claude-model <model>    Claude model (default: claude-opus-4-5-20251101)
  --codex-model <model>     Codex model (default: gpt-5.2-codex)
  --gemini-model <model>    Gemini model (default: gemini-2.5-pro)
  --kimi-model <model>      Kimi model (default: kimi-k2.5)
  --glm-model <model>       GLM model (default: glm-5.1)
  --opencode-model <model>  OpenCode model (e.g., ollama/gemma4:26b)

${YELLOW}Image Management (air-gapped deployment):${NC}
  --export-images <file>    Export all Docker images to tar archive
  --import-images <file>    Import Docker images from tar archive

${YELLOW}Examples:${NC}
  # Single agent run
  $0 --prompt prompts/attack.txt --claude --mode struct
  $0 --prompt prompts/attack.txt --agent gemini --mode report

  # Parallel runs (separate terminals or background)
  $0 --prompt prompts/attack.txt --claude --mode struct &
  $0 --prompt prompts/attack.txt --codex --mode struct &
  $0 --prompt prompts/attack.txt --gemini --mode struct &

  # Rerun a session
  $0 --rerun juice-shop_claude_guided_structured_01

  # Air-gapped deployment
  $0 --export-images images.tar   # On source machine
  $0 --import-images images.tar   # On air-gapped machine

${YELLOW}Notes:${NC}
  - Each run creates an isolated Docker network (safe for parallel execution)
  - Results are saved to ./results/<session_id>/

EOF
    exit 0
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --prompt)
                PROMPT_FILE="$2"
                shift 2
                ;;
            --agent)
                AGENT_TYPE="$2"
                shift 2
                ;;
            --claude)
                AGENT_TYPE="claude"
                shift
                ;;
            --codex)
                AGENT_TYPE="codex"
                shift
                ;;
            --gemini)
                AGENT_TYPE="gemini"
                shift
                ;;
            --kimi)
                AGENT_TYPE="kimi"
                shift
                ;;
            --glm)
                AGENT_TYPE="glm"
                shift
                ;;
            --opencode)
                AGENT_TYPE="opencode"
                shift
                ;;
            --victim)
                VICTIM_TYPE="$2"
                shift 2
                ;;
            --victim-port)
                CUSTOM_VICTIM_PORT="$2"
                shift 2
                ;;
            --mode)
                MODE="$2"
                if [[ "$MODE" != "report" && "$MODE" != "struct" ]]; then
                    log_error "Invalid mode: $MODE (must be 'report' or 'struct')"
                    exit 1
                fi
                shift 2
                ;;
            --output-format)
                OUTPUT_FORMAT_FILE="$2"
                if [[ ! -f "$OUTPUT_FORMAT_FILE" ]]; then
                    log_error "Output format file not found: $OUTPUT_FORMAT_FILE"
                    exit 1
                fi
                shift 2
                ;;
            --keep)
                KEEP_CONTAINERS=true
                shift
                ;;
            --build)
                BUILD_IMAGES=true
                shift
                ;;
            --rerun)
                RERUN_SESSION="$2"
                shift 2
                ;;
            --session-suffix)
                SESSION_SUFFIX="$2"
                shift 2
                ;;
            --token-limit)
                TOKEN_LIMIT="$2"
                shift 2
                ;;
            --call-limit)
                CALL_LIMIT="$2"
                shift 2
                ;;
            --claude-model)
                CLAUDE_MODEL="$2"
                CLAUDE_MODEL_CLI_SET=true
                shift 2
                ;;
            --codex-model)
                CODEX_MODEL="$2"
                CODEX_MODEL_CLI_SET=true
                shift 2
                ;;
            --gemini-model)
                GEMINI_MODEL="$2"
                GEMINI_MODEL_CLI_SET=true
                shift 2
                ;;
            --kimi-model)
                KIMI_MODEL="$2"
                KIMI_MODEL_CLI_SET=true
                shift 2
                ;;
            --glm-model)
                GLM_MODEL="$2"
                GLM_MODEL_CLI_SET=true
                shift 2
                ;;
            --opencode-model)
                OPENCODE_MODEL="$2"
                OPENCODE_MODEL_CLI_SET=true
                shift 2
                ;;
            --export-images)
                export_images "$2"
                exit 0
                ;;
            --import-images)
                import_images "$2"
                exit 0
                ;;
            --help|-h)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Validate inputs
validate_inputs() {
    if [[ -z "$PROMPT_FILE" ]]; then
        log_error "--prompt is required"
        echo "Use --help for usage information"
        exit 1
    fi
    if [[ ! -f "$PROMPT_FILE" ]]; then
        log_error "Prompt file not found: $PROMPT_FILE"
        exit 1
    fi

    # Check agent selection
    if [[ -z "$AGENT_TYPE" ]]; then
        log_error "Agent must be specified (--claude, --codex, --gemini, --kimi, --glm, --opencode, or --agent <type>)"
        exit 1
    fi
    case "$AGENT_TYPE" in
        claude|codex|gemini|kimi|glm|opencode) ;;
        *)
            log_error "Unknown agent type: $AGENT_TYPE (supported: claude, codex, gemini, kimi, glm, opencode)"
            exit 1
            ;;
    esac

    # Check agent Dockerfile exists
    if [[ ! -f "agents/${AGENT_TYPE}/Dockerfile" ]]; then
        log_error "Dockerfile not found: agents/${AGENT_TYPE}/Dockerfile"
        log_error "Build the agent image first or check the agent type."
        exit 1
    fi

    # Check .env file
    if [[ ! -f ".env" ]]; then
        log_error ".env file not found"
        echo "Please copy .env.example to .env and fill in your API keys:"
        echo "  cp .env.example .env"
        exit 1
    fi

    # Validate API key for selected agent
    source .env
    case "$AGENT_TYPE" in
        claude)
            if [[ -z "$ANTHROPIC_API_KEY" || "$ANTHROPIC_API_KEY" == "sk-ant-..." ]]; then
                log_warn "ANTHROPIC_API_KEY not set in .env (required for Claude agent)"
            fi
            ;;
        codex)
            if [[ -z "$OPENAI_API_KEY" || "$OPENAI_API_KEY" == "sk-..." ]]; then
                log_warn "OPENAI_API_KEY not set in .env (required for Codex agent)"
            fi
            ;;
        gemini)
            if [[ -z "$GOOGLE_API_KEY" || "$GOOGLE_API_KEY" == "AIza..." ]]; then
                log_warn "GOOGLE_API_KEY not set in .env (required for Gemini agent)"
            fi
            ;;
        kimi)
            if [[ -z "$KIMI_API_KEY" || "$KIMI_API_KEY" == "sk-..." ]]; then
                log_warn "KIMI_API_KEY not set in .env (required for Kimi agent)"
            fi
            ;;
        glm)
            if [[ -z "$GLM_API_KEY" || "$GLM_API_KEY" == "***" ]]; then
                log_warn "GLM_API_KEY not set in .env (required for GLM agent)"
            fi
            if [[ -z "$GLM_BASE_URL" ]]; then
                log_warn "GLM_BASE_URL not set in .env (default expected: https://api.z.ai/api/paas/v4)"
            fi
            ;;
        opencode)
            log_info "OpenCode agent — API key validation depends on model provider"
            ;;
    esac
}

# Configure victim server settings
configure_victim() {
    case "$VICTIM_TYPE" in
        juice-shop)
            export VICTIM_IMAGE="bkimminich/juice-shop:19.1.1"
            export VICTIM_PORT="3000"
            ;;
        webgoat)
            export VICTIM_IMAGE="webgoat/webgoat"
            export VICTIM_PORT="8080"
            ;;
        vuln-shop)
            export VICTIM_IMAGE="vuln-shop:latest"
            export VICTIM_PORT="3000"
            if ! docker images | grep -q "vuln-shop"; then
                log_info "Building vuln-shop image from ./victims/vuln-shop..."
                docker build -t vuln-shop:latest ./victims/vuln-shop
            fi
            ;;
        bentoml)
            export VICTIM_IMAGE="bentoml-vulnerable:1.4.2"
            export VICTIM_PORT="3000"
            export VICTIM_APP_ROOT="/app"
            if [[ "$BUILD_IMAGES" == "true" ]] || ! docker images | grep -q "bentoml-vulnerable"; then
                log_info "Building bentoml-vulnerable image from ./victims/bentoml..."
                docker build -t bentoml-vulnerable:1.4.2 ./victims/bentoml
            fi
            ;;
        mlflow)
            export VICTIM_IMAGE="mlflow-vulnerable:2.9.2"
            export VICTIM_PORT="5000"
            export VICTIM_APP_ROOT="/mlflow"
            if [[ "$BUILD_IMAGES" == "true" ]] || ! docker images | grep -q "mlflow-vulnerable"; then
                log_info "Building mlflow-vulnerable image from ./victims/mlflow..."
                docker build -t mlflow-vulnerable:2.9.2 ./victims/mlflow
            fi
            ;;
        gradio)
            export VICTIM_IMAGE="gradio-vulnerable:4.19.0"
            export VICTIM_PORT="7860"
            export VICTIM_APP_ROOT="/app"
            if [[ "$BUILD_IMAGES" == "true" ]] || ! docker images | grep -q "gradio-vulnerable"; then
                log_info "Building gradio-vulnerable image from ./victims/gradio..."
                docker build -t gradio-vulnerable:4.19.0 ./victims/gradio
            fi
            ;;
        *)
            # Custom Docker image. The agent's entrypoint waits up to 60s for
            # the victim to respond on port $VICTIM_PORT before starting attacks.
            export VICTIM_IMAGE="$VICTIM_TYPE"
            export VICTIM_PORT="${CUSTOM_VICTIM_PORT:-3000}"
            log_info "Using custom victim image: $VICTIM_IMAGE"
            ;;
    esac
    log_info "Victim: $VICTIM_TYPE ($VICTIM_IMAGE:$VICTIM_PORT)"
}

# Resolve prompt path inside container. If the file is already under ./prompts/,
# mount it by its existing basename (no copy). Otherwise stage it as a session-
# unique file so parallel runs never share mutable state.
resolve_prompt_container_path() {
    local host_realpath prompts_realpath host_dir
    host_realpath=$(realpath "$PROMPT_FILE")
    prompts_realpath=$(realpath prompts)
    host_dir=$(dirname "$host_realpath")

    if [[ "$host_dir" == "$prompts_realpath" ]]; then
        PROMPT_CONTAINER_PATH="/prompts/$(basename "$host_realpath")"
    else
        TEMP_PROMPT_FILE="prompts/.attack-${SESSION_TIMESTAMP}.txt"
        cp "$PROMPT_FILE" "$TEMP_PROMPT_FILE"
        PROMPT_CONTAINER_PATH="/prompts/.attack-${SESSION_TIMESTAMP}.txt"
    fi
    export PROMPT_CONTAINER_PATH
}

# --- COMPOSE FILE GENERATION -------------------------------------------------
# Generates a session-specific docker-compose YAML.
# Each session gets unique network + container names -> parallel-safe.
generate_compose() {
    local agent_type=$1
    local session_id=$2

    COMPOSE_FILE="${SCRIPT_DIR}/.compose-${session_id}.yml"
    COMPOSE_PROJECT="cybias-${session_id}"

    # Build agent-specific environment block.
    # Single-quoted strings: ${VAR} appears literally for docker-compose resolution.
    # Double-quoted appends: bash variables are expanded at generation time.
    local agent_env=""
    case "$agent_type" in
        claude)
            agent_env='      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ANTHROPIC_BASE_URL=http://metrics-proxy:4000
      - AGENT_TYPE=claude'
            agent_env="${agent_env}
      - CLAUDE_MODEL=${CLAUDE_MODEL}"
            ;;
        codex)
            agent_env='      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=http://metrics-proxy:4000
      - AGENT_TYPE=codex'
            agent_env="${agent_env}
      - CODEX_MODEL=${CODEX_MODEL}"
            ;;
        gemini)
            agent_env='      - GEMINI_API_KEY=${GOOGLE_API_KEY}
      - GOOGLE_GEMINI_BASE_URL=http://metrics-proxy:4000
      - AGENT_TYPE=gemini'
            agent_env="${agent_env}
      - GEMINI_MODEL=${GEMINI_MODEL}"
            ;;
        kimi)
            agent_env='      - KIMI_API_KEY=${KIMI_API_KEY}
      - KIMI_BASE_URL=http://metrics-proxy:4000
      - AGENT_TYPE=kimi'
            agent_env="${agent_env}
      - KIMI_MODEL=${KIMI_MODEL}"
            ;;
        glm)
            # GLM agent uses OpenCode CLI against the OpenAI-compatible LiteLLM proxy.
            agent_env='      - OPENAI_API_KEY=***
      - OPENAI_BASE_URL=http://metrics-proxy:4000
      - AGENT_TYPE=glm'
            agent_env="${agent_env}
      - GLM_MODEL=${GLM_MODEL}"
            ;;
        opencode)
            # OpenCode v0.0.55 uses OpenAI SDK internally.
            # OPENAI_BASE_URL -> LiteLLM proxy -> Ollama (or other provider)
            agent_env='      - OPENAI_API_KEY=ollama
      - OPENAI_BASE_URL=http://metrics-proxy:4000
      - AGENT_TYPE=opencode'
            agent_env="${agent_env}
      - OPENCODE_MODEL=${OPENCODE_MODEL}"
            ;;
    esac
    # Append common agent environment variables (expanded at generation time)
    agent_env="${agent_env}
      - PROMPT_FILE=${PROMPT_CONTAINER_PATH}
      - OUTPUT_MODE=${OUTPUT_MODE}
      - OUTPUT_FORMAT_FILE=${OUTPUT_FORMAT_FILE:-}
      - SESSION_TIMESTAMP=${session_id}
      - VICTIM_HOST=http-logger
      - VICTIM_PORT=8080"

    # For opencode sessions, generate a LiteLLM config that routes
    # gpt-4o -> the specified Ollama model (no real OpenAI/Anthropic routes).
    local litellm_config="./metrics/litellm_config.yaml"
    local proxy_openai_key="\${OPENAI_API_KEY}"
    if [[ "$agent_type" == "opencode" ]]; then
        # Extract Ollama model name from OPENCODE_MODEL (strip "openai/" prefix)
        local ollama_model="${OPENCODE_MODEL#openai/}"
        # Default to qwen3-235b-agent if not specified
        [[ -z "$ollama_model" || "$ollama_model" == "gpt-4o" ]] && ollama_model="qwen3-235b-agent"

        # Generate session-specific LiteLLM config for this Ollama model
        litellm_config="./${SESSION_DIR}/litellm_config_opencode.yaml"
        cat > "$litellm_config" << LITELLM_EOF
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: ollama/${ollama_model}
      api_base: os.environ/OLLAMA_API_BASE
  - model_name: gpt-4o-mini
    litellm_params:
      model: ollama/${ollama_model}
      api_base: os.environ/OLLAMA_API_BASE
litellm_settings:
  drop_params: true
  json_logs: true
  set_verbose: true
  success_callback: ["custom_logger.metrics_logger"]
  failure_callback: ["custom_logger.metrics_logger"]
  callbacks: ["custom_logger.metrics_logger"]
general_settings:
  disable_spend_logs: false
  store_model_in_db: false
environment_variables:
  METRICS_LOG_DIR: /app/logs
LITELLM_EOF
        log_info "LiteLLM config generated for Ollama model: ${ollama_model}"
        proxy_openai_key="unused"
    fi

    cat > "$COMPOSE_FILE" << EOF
# Auto-generated by run.sh for session: ${session_id}
# DO NOT EDIT - regenerated on each run
networks:
  default:
    name: net-${session_id}
    driver: bridge

services:
  # ---- Metrics Proxy (LiteLLM) ----
  metrics-proxy:
    image: ghcr.io/berriai/litellm@sha256:d716aceae1cfc119f6b64fe7dc50848e019ed35980315c557718a062924e0636
    container_name: proxy-${session_id}
    command: ["--config", "/app/config.yaml", "--detailed_debug"]
    environment:
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${proxy_openai_key}
      - GOOGLE_API_KEY=\${GOOGLE_API_KEY}
      - KIMI_API_KEY=\${KIMI_API_KEY}
      - GLM_API_KEY=\${GLM_API_KEY}
      - GLM_BASE_URL=\${GLM_BASE_URL:-https://api.z.ai/api/paas/v4}
      - LITELLM_LOG=DEBUG
      - METRICS_LOG_DIR=/app/logs
      - PYTHONPATH=/app
      - AGENT_TOKEN_LIMIT=\${AGENT_TOKEN_LIMIT:-0}
      - AGENT_CALL_LIMIT=\${AGENT_CALL_LIMIT:-0}
      - OLLAMA_API_BASE=\${OLLAMA_API_BASE:-}
    volumes:
      - ${litellm_config}:/app/config.yaml:ro
      - ./metrics/custom_logger.py:/app/custom_logger.py:ro
      - ./${SESSION_DIR}/api-logs:/app/logs
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:4000/health/liveliness')"]
      interval: 5s
      timeout: 5s
      retries: 10

  # ---- Victim Server ----
  victim:
    image: ${VICTIM_IMAGE}
    container_name: victim-${session_id}
    ports:
      - "0:${VICTIM_PORT}"

  # ---- HTTP Traffic Logger (mitmproxy) ----
  http-logger:
    image: mitmproxy/mitmproxy:latest
    container_name: logger-${session_id}
    command: mitmdump --mode reverse:http://victim:${VICTIM_PORT} -p 8080 -s /scripts/http_logger.py --set block_global=false
    environment:
      - AGENT_NAME=${agent_type}
      - LOG_DIR=/logs
    volumes:
      - ./metrics/http_logger.py:/scripts/http_logger.py:ro
      - ./${SESSION_DIR}/http-logs:/logs
    depends_on:
      - victim

  # ---- Agent ----
  agent:
    build:
      context: ./agents
      dockerfile: ${agent_type}/Dockerfile
    image: agent-${agent_type}:latest
    container_name: agent-${session_id}
    environment:
${agent_env}
    volumes:
      - ./prompts:/prompts:ro
      - ./output_formats:/output_formats:ro
    depends_on:
      http-logger:
        condition: service_started
      metrics-proxy:
        condition: service_healthy
EOF

    log_info "Compose file generated: $(basename "$COMPOSE_FILE")"
}

# Build Docker images
build_images() {
    log_step "Building Docker images..."

    # Build base image first (all agent images inherit from this)
    log_info "Building agent-base image..."
    docker build -t agent-base:latest -f agents/base/Dockerfile agents/

    # Build agent-specific image
    log_info "Building agent-${AGENT_TYPE} image..."
    docker build -t "agent-${AGENT_TYPE}:latest" -f "agents/${AGENT_TYPE}/Dockerfile" agents/

    log_info "All images built successfully"
}

# Extract results from agent container
extract_results() {
    log_info "Extracting results from container..."
    docker cp "agent-${SESSION_TIMESTAMP}:/results/." "./${SESSION_DIR}/output/" 2>/dev/null || true
    log_info "Results extracted"
}

# Verify challenges on victim (while still running)
verify_challenges() {
    log_info "Verifying challenges on victim..."

    case "$VICTIM_TYPE" in
        juice-shop|vuln-shop)
            # Check if victim container is running
            if [[ "$(docker inspect --format='{{.State.Running}}' "victim-${SESSION_TIMESTAMP}" 2>/dev/null)" != "true" ]]; then
                log_warn "Victim container is not running"
                echo "{\"agent\": \"${AGENT_TYPE}\", \"error\": \"Victim container not running\"}" \
                    > "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json"
                return
            fi

            # Get dynamically assigned host port
            local host_port
            host_port=$(docker port "victim-${SESSION_TIMESTAMP}" "${VICTIM_PORT}" 2>/dev/null | tail -1 | cut -d: -f2)
            if [[ -z "$host_port" ]]; then
                log_warn "Could not determine victim host port"
                echo "{\"agent\": \"${AGENT_TYPE}\", \"error\": \"Could not determine host port\"}" \
                    > "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json"
                return
            fi

            # Query challenge API via dynamically assigned host port
            local challenges_json
            challenges_json=$(curl -sf "http://localhost:${host_port}/api/Challenges/" 2>/dev/null) || true

            if [[ -n "$challenges_json" ]]; then
                echo "$challenges_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
solved = [c for c in data.get('data', []) if c.get('solved')]
result = {
    'agent': '${AGENT_TYPE}',
    'victim_type': '${VICTIM_TYPE}',
    'total_challenges': len(data.get('data', [])),
    'solved_count': len(solved),
    'solved_challenges': [
        {
            'key': c.get('key'),
            'name': c.get('name'),
            'category': c.get('category'),
            'difficulty': c.get('difficulty')
        }
        for c in solved
    ]
}
print(json.dumps(result, indent=2))
" > "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json" 2>/dev/null

                local solved_count
                solved_count=$(jq '.solved_count' "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json" 2>/dev/null || echo "0")
                log_info "Challenges solved: $solved_count"
            else
                log_warn "Could not query challenge API at localhost:${host_port}"
                echo "{\"agent\": \"${AGENT_TYPE}\", \"error\": \"Could not query challenge API\", \"attempted_port\": \"${host_port}\"}" \
                    > "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json"
            fi
            ;;
        bentoml|mlflow|gradio)
            log_info "Log-based verification will be done in analysis phase"
            ;;
        *)
            log_info "No challenge verification for victim type: $VICTIM_TYPE"
            ;;
    esac
}

# Extract metrics (the proxy logs directly to the session dir via volume mount)
extract_metrics() {
    log_step "Extracting metrics..."

    # Save proxy debug log
    docker logs "proxy-${SESSION_TIMESTAMP}" 2>&1 > "./${SESSION_DIR}/api-logs/proxy.log" 2>/dev/null || true

    # usage.jsonl is written directly to ${SESSION_DIR}/api-logs/ by the proxy volume mount.
    # No timestamp filtering or extraction needed.

    # Aggregate metrics
    if [[ -f "./scripts/aggregate_metrics.py" ]]; then
        python3 ./scripts/aggregate_metrics.py "./${SESSION_DIR}/api-logs" \
            --output "./${SESSION_DIR}/analysis/summary.json" 2>/dev/null || true
    fi

    log_info "Metrics extracted"
}

# Run analysis pipeline. Classifier and verifier live in CyBiasBench/scripts/
# (one directory above benchmark/) so that R1 (re-analysis from released
# traces) and R3 (re-experiment) share the same implementation.
regenerate_analysis() {
    local classify_script="../scripts/classify/classify_attacks.py"
    local verify_script="../scripts/verify/verify_success.py"
    local http_logs_dir="./${SESSION_DIR}/http-logs"
    local analysis_dir="./${SESSION_DIR}/analysis"

    log_step "Classifying HTTP attacks..."
    if [[ -f "$classify_script" ]] && ls "$http_logs_dir"/*_http.jsonl 1>/dev/null 2>&1; then
        python3 "$classify_script" "$http_logs_dir" -o "$analysis_dir" --summary \
            --victim-type "$VICTIM_TYPE" 2>&1 | \
            grep -E "(Processing|Classified|Summary|By Attack)" || true
        log_info "Attack classification complete"
    else
        log_warn "Skipped classification (script or HTTP logs missing)"
    fi

    log_step "Verifying attack success (ASR)..."
    if [[ -f "$verify_script" ]] && ls "$analysis_dir"/*_attack_labeled.jsonl 1>/dev/null 2>&1; then
        python3 "$verify_script" \
            --http-logs "$analysis_dir" \
            --victim-type "$VICTIM_TYPE" \
            --output "$analysis_dir/vulnerability_results.json" 2>&1 | \
            grep -E "(Verif|ASR|Success|agent)" || true
        log_info "Attack success verification complete"
    fi
}

# --- RERUN SUPPORT -----------------------------------------------------------

# Load session parameters from session.json
load_session_params() {
    local session_dir=$1
    local session_json="$session_dir/session.json"

    if [[ ! -f "$session_json" ]]; then
        log_error "session.json not found in $session_dir"
        exit 1
    fi

    eval "$(python3 -c "
import json, shlex

with open('$session_json') as f:
    meta = json.load(f)

v = meta.get('victim', {})
print(f'VICTIM_TYPE={shlex.quote(v.get(\"type\", \"juice-shop\"))}')
print(f'VICTIM_IMAGE={shlex.quote(v.get(\"image\", \"\"))}')
print(f'VICTIM_PORT={shlex.quote(str(v.get(\"port\", 3000)))}')
print(f'MODE={shlex.quote(meta.get(\"mode\", \"report\"))}')

pf = meta.get('prompt_file', '')
if pf:
    print(f'PROMPT_FILE_FROM_SESSION={shlex.quote(pf)}')
of = meta.get('output_format_file', '')
if of:
    print(f'OUTPUT_FORMAT_FILE_FROM_SESSION={shlex.quote(of)}')

lim = meta.get('limits', {})
print(f'TOKEN_LIMIT={shlex.quote(str(lim.get(\"token\", 0)))}')
print(f'CALL_LIMIT={shlex.quote(str(lim.get(\"call\", 0)))}')

# Auto-detect agent and model from session
agents = meta.get('agents', {})
agent_list = list(agents.keys())
if len(agent_list) == 1:
    print(f'AGENT_FROM_SESSION={shlex.quote(agent_list[0])}')
    a = agents[agent_list[0]]
    if a.get('model'):
        var = agent_list[0].upper() + '_MODEL_FROM_SESSION'
        print(f'{var}={shlex.quote(a[\"model\"])}')
elif len(agent_list) > 1:
    print('MULTI_AGENT_SESSION=true')
    for a_name in agent_list:
        a = agents[a_name]
        if a.get('model'):
            var = a_name.upper() + '_MODEL_FROM_SESSION'
            print(f'{var}={shlex.quote(a[\"model\"])}')
")"

    log_info "Loaded session parameters from session.json"

    # Auto-detect agent from session if not specified on CLI
    if [[ -z "$AGENT_TYPE" ]]; then
        if [[ -n "${AGENT_FROM_SESSION:-}" ]]; then
            AGENT_TYPE="$AGENT_FROM_SESSION"
            log_info "Auto-detected agent from session: $AGENT_TYPE"
        elif [[ "${MULTI_AGENT_SESSION:-}" == "true" ]]; then
            log_error "Multi-agent legacy session. Specify agent: --claude, --codex, or --gemini"
            exit 1
        fi
    fi

    # Apply session models only if not overridden by CLI
    if [[ -n "${CLAUDE_MODEL_FROM_SESSION:-}" && "$CLAUDE_MODEL_CLI_SET" != "true" ]]; then
        CLAUDE_MODEL="$CLAUDE_MODEL_FROM_SESSION"
    fi
    if [[ -n "${CODEX_MODEL_FROM_SESSION:-}" && "$CODEX_MODEL_CLI_SET" != "true" ]]; then
        CODEX_MODEL="$CODEX_MODEL_FROM_SESSION"
    fi
    if [[ -n "${GEMINI_MODEL_FROM_SESSION:-}" && "$GEMINI_MODEL_CLI_SET" != "true" ]]; then
        GEMINI_MODEL="$GEMINI_MODEL_FROM_SESSION"
    fi
    if [[ -n "${KIMI_MODEL_FROM_SESSION:-}" && "$KIMI_MODEL_CLI_SET" != "true" ]]; then
        KIMI_MODEL="$KIMI_MODEL_FROM_SESSION"
    fi
    if [[ -n "${GLM_MODEL_FROM_SESSION:-}" && "$GLM_MODEL_CLI_SET" != "true" ]]; then
        GLM_MODEL="$GLM_MODEL_FROM_SESSION"
    fi
    if [[ -n "${OPENCODE_MODEL_FROM_SESSION:-}" && "$OPENCODE_MODEL_CLI_SET" != "true" ]]; then
        OPENCODE_MODEL="$OPENCODE_MODEL_FROM_SESSION"
    fi
}

# Re-run an existing session
rerun_session() {
    local session_dir="results/${RERUN_SESSION}"

    # 1) Validate session exists
    if [[ ! -d "$session_dir" ]]; then
        log_error "Session not found: $RERUN_SESSION"
        exit 1
    fi
    if [[ ! -f ".env" ]]; then
        log_error ".env file not found"
        exit 1
    fi

    # 2) Load session parameters (may auto-detect AGENT_TYPE)
    load_session_params "$session_dir"
    if [[ -z "$AGENT_TYPE" ]]; then
        log_error "Could not determine agent type. Specify with --claude/--codex/--gemini/--kimi/--glm/--opencode"
        exit 1
    fi
    configure_victim

    # Apply format/prompt from session if not overridden
    if [[ -z "$OUTPUT_FORMAT_FILE" && -n "${OUTPUT_FORMAT_FILE_FROM_SESSION:-}" ]]; then
        [[ -f "output_formats/$OUTPUT_FORMAT_FILE_FROM_SESSION" ]] && \
            OUTPUT_FORMAT_FILE="output_formats/$OUTPUT_FORMAT_FILE_FROM_SESSION"
    fi
    if [[ -z "$PROMPT_FILE" && -n "${PROMPT_FILE_FROM_SESSION:-}" ]]; then
        [[ -f "prompts/$PROMPT_FILE_FROM_SESSION" ]] && \
            PROMPT_FILE="prompts/$PROMPT_FILE_FROM_SESSION"
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Re-run Mode${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Session:    $RERUN_SESSION"
    echo -e "Agent:      $AGENT_TYPE"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # 3) Set environment
    source .env
    export OUTPUT_MODE="$MODE"
    export AGENT_TOKEN_LIMIT="$TOKEN_LIMIT"
    export AGENT_CALL_LIMIT="$CALL_LIMIT"
    export CLAUDE_MODEL CODEX_MODEL GEMINI_MODEL KIMI_MODEL GLM_MODEL OPENCODE_MODEL
    if [[ -n "$OUTPUT_FORMAT_FILE" ]]; then
        export OUTPUT_FORMAT_FILE="/output_formats/$(basename "$OUTPUT_FORMAT_FILE")"
    fi

    export SESSION_DIR="$session_dir"
    export SESSION_TIMESTAMP="$RERUN_SESSION"
    mkdir -p "${SESSION_DIR}/output" "${SESSION_DIR}/api-logs" \
             "${SESSION_DIR}/http-logs" "${SESSION_DIR}/analysis"

    # 4) Backup existing files
    log_step "Backing up existing files..."
    local backup_dir="${SESSION_DIR}/.backup/${AGENT_TYPE}_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    local backed_up=0
    for pattern in \
        "output/${AGENT_TYPE}."* \
        "http-logs/${AGENT_TYPE}_http.jsonl" \
        "api-logs/${AGENT_TYPE}_conversations.jsonl" \
        "api-logs/usage.jsonl" \
        "api-logs/proxy.log" \
        "analysis/${AGENT_TYPE}_attack_labeled.jsonl" \
        "analysis/${AGENT_TYPE}_challenges.json" \
        "analysis/summary.json" \
        "analysis/vulnerability_results.json" \
        "analysis/attack_summary.json"; do
        for f in ${SESSION_DIR}/$pattern; do
            if [[ -f "$f" ]]; then
                cp "$f" "$backup_dir/"
                rm -f "$f"
                backed_up=$((backed_up + 1))
            fi
        done
    done
    log_info "Backed up $backed_up files to $backup_dir"

    # 5) Resolve container prompt path (parallel-safe) and generate compose
    resolve_prompt_container_path
    generate_compose "$AGENT_TYPE" "$SESSION_TIMESTAMP"

    if [[ "$BUILD_IMAGES" == "true" ]] || ! docker images | grep -q "agent-base"; then
        build_images
    fi

    run_experiment

    # 6) Record rerun history
    local rerun_end_time
    rerun_end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    python3 -c "
import json

path = './${SESSION_DIR}/session.json'
with open(path) as f:
    data = json.load(f)

if 'rerun_history' not in data:
    data['rerun_history'] = []

data['rerun_history'].append({
    'timestamp': '$rerun_end_time',
    'agent': '$AGENT_TYPE',
    'started_at': '$SESSION_START_TIME',
    'finished_at': '$rerun_end_time'
})

# Update status to rerun_completed if agent succeeded
a = data['agents'].get('$AGENT_TYPE', {})
if a.get('status') == 'completed':
    a['status'] = 'rerun_completed'

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
"

    # 7) Cleanup
    if [[ "$KEEP_CONTAINERS" == "false" ]]; then
        log_step "Cleaning up containers..."
        dc down --remove-orphans
        rm -f "$COMPOSE_FILE"
    else
        log_info "Containers kept. Stop with: docker compose -f $(basename "$COMPOSE_FILE") -p $COMPOSE_PROJECT down"
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Re-run Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Session:    ${BLUE}./${SESSION_DIR}/${NC}"
    echo -e "Agent:      $AGENT_TYPE"
    echo -e "Backup:     ${BLUE}$backup_dir${NC}"
    echo ""
}

# --- CORE EXPERIMENT EXECUTION -----------------------------------------------

# Run the experiment: proxy -> victim -> logger -> agent -> extract
run_experiment() {
    # Record start time
    SESSION_START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    export SESSION_START_TIME

    # Start metrics proxy
    log_step "Starting metrics proxy..."
    dc up -d --force-recreate metrics-proxy

    local proxy_wait=0
    while [[ "$(docker inspect --format='{{.State.Health.Status}}' "proxy-${SESSION_TIMESTAMP}" 2>/dev/null)" != "healthy" ]]; do
        sleep 2
        proxy_wait=$((proxy_wait + 2))
        if [[ $proxy_wait -ge 60 ]]; then
            log_error "Metrics proxy did not become healthy after 60s"
            docker logs "proxy-${SESSION_TIMESTAMP}" --tail 20 2>/dev/null || true
            exit 1
        fi
    done
    log_info "Metrics proxy is ready!"

    # Start victim
    log_step "Starting victim..."
    dc up -d --force-recreate victim
    local waited=0
    while [[ "$(docker inspect --format='{{.State.Running}}' "victim-${SESSION_TIMESTAMP}" 2>/dev/null)" != "true" ]]; do
        sleep 2
        waited=$((waited + 2))
        if [[ $waited -ge 60 ]]; then
            log_error "Victim container failed to start"
            exit 1
        fi
    done
    sleep 5
    log_info "Victim is running"

    # Start HTTP traffic logger
    log_info "Starting HTTP traffic logger..."
    dc up -d --force-recreate http-logger
    sleep 2

    # Run agent (foreground - blocks until complete)
    update_agent_status "running"
    log_step "Executing agent (${AGENT_TYPE})..."
    local agent_exit=0
    dc up --force-recreate agent || agent_exit=$?

    # Extract results while victim is still running
    extract_results
    verify_challenges

    # Update status
    if [[ $agent_exit -eq 0 ]]; then
        update_agent_status "completed" 0
    else
        update_agent_status "failed" "$agent_exit"
    fi
    log_info "Agent completed (exit: $agent_exit)"

    # Extract metrics and run analysis
    extract_metrics

    # Extract agent conversation logs
    log_step "Extracting conversation logs..."
    if [[ -f "./${SESSION_DIR}/api-logs/usage.jsonl" ]]; then
        jq -c --arg a "$AGENT_TYPE" 'select(.agent == $a)' \
            "./${SESSION_DIR}/api-logs/usage.jsonl" \
            > "./${SESSION_DIR}/api-logs/${AGENT_TYPE}_conversations.jsonl" 2>/dev/null || true
        if [[ ! -s "./${SESSION_DIR}/api-logs/${AGENT_TYPE}_conversations.jsonl" ]]; then
            rm -f "./${SESSION_DIR}/api-logs/${AGENT_TYPE}_conversations.jsonl"
        fi
    fi

    # HTTP traffic summary
    local http_log="./${SESSION_DIR}/http-logs/${AGENT_TYPE}_http.jsonl"
    if [[ -f "$http_log" ]]; then
        local request_count
        request_count=$(wc -l < "$http_log")
        log_info "$request_count HTTP requests logged"
    fi

    regenerate_analysis

    # Record end time
    SESSION_END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    export SESSION_END_TIME
}

# --- IMAGE EXPORT/IMPORT (air-gapped deployment) -----------------------------

export_images() {
    local output_file=$1
    log_step "Exporting Docker images to ${output_file}..."

    local images=(
        "agent-base:latest"
        "ghcr.io/berriai/litellm@sha256:d716aceae1cfc119f6b64fe7dc50848e019ed35980315c557718a062924e0636"
        "mitmproxy/mitmproxy:latest"
    )

    # Add built agent images
    for agent in claude codex gemini kimi glm opencode; do
        if docker images "agent-${agent}:latest" --format '{{.Repository}}' 2>/dev/null | grep -q "agent-${agent}"; then
            images+=("agent-${agent}:latest")
        fi
    done

    # Add victim images (only if they exist locally)
    for img in "bkimminich/juice-shop" "bentoml-vulnerable:1.4.2" "mlflow-vulnerable:2.9.2" \
               "gradio-vulnerable:4.19.0" "vuln-shop:latest"; do
        if docker images "$img" --format '{{.Repository}}' 2>/dev/null | grep -q .; then
            images+=("$img")
        fi
    done

    log_info "Exporting ${#images[@]} images..."
    docker save "${images[@]}" -o "$output_file"
    log_info "Images exported to $output_file ($(du -h "$output_file" | cut -f1))"
}

import_images() {
    local input_file=$1
    if [[ ! -f "$input_file" ]]; then
        log_error "Image archive not found: $input_file"
        exit 1
    fi
    log_step "Importing Docker images from ${input_file}..."
    docker load -i "$input_file"
    log_info "Images imported successfully"
}

# --- MAIN --------------------------------------------------------------------

reserve_session_timestamp() {
    local session_prefix=$1
    local lock_dir="results/.session-locks"
    mkdir -p "$lock_dir"

    local lock_fd
    exec {lock_fd}>"${lock_dir}/${session_prefix}.lock"
    flock -x "$lock_fd"

    local seq_num
    if [[ -n "$SESSION_SUFFIX" ]]; then
        # Explicit suffix pinned by caller (e.g. parallel launcher)
        seq_num=$(printf "%02d" "$((10#$SESSION_SUFFIX))")
        if [[ -d "results/${session_prefix}_${seq_num}" ]]; then
            flock -u "$lock_fd"
            exec {lock_fd}>&-
            log_error "Session already exists: results/${session_prefix}_${seq_num}"
            exit 1
        fi
    else
        local existing_count
        existing_count=$(find results -maxdepth 1 -type d -name "${session_prefix}_*" | wc -l)
        seq_num=$(printf "%02d" $((existing_count + 1)))
    fi

    export SESSION_TIMESTAMP="${session_prefix}_${seq_num}"
    export SESSION_DIR="results/${SESSION_TIMESTAMP}"
    mkdir -p "$SESSION_DIR"

    flock -u "$lock_fd"
    exec {lock_fd}>&-
}

main() {
    parse_args "$@"

    # Branch: rerun mode vs normal mode
    if [[ -n "$RERUN_SESSION" ]]; then
        rerun_session
        return
    fi

    validate_inputs

    # Generate session ID (includes agent name for uniqueness)
    local _prompt_basename
    _prompt_basename=$(basename "$PROMPT_FILE" .txt)

    # Session ids keep the 'scen2' (bias_injection) and guidance/structure
    # (bias_observation) tokens of the original experiment naming: the released
    # records contain these substrings and ../scripts/aggregate/ parses them,
    # so renaming would break round-trip closure.
    local _session_prefix
    if [[ "$_prompt_basename" == scen2_* ]]; then
        # bias_injection: {victim}_{agent}_scen2_{family}_{NN}
        local _tech="${_prompt_basename#scen2_}"
        _session_prefix="${VICTIM_TYPE}_${AGENT_TYPE}_scen2_${_tech}"
    else
        # bias_observation: {victim}_{agent}_{guidance}_{structure}_{NN}
        local _guidance
        if [[ "$_prompt_basename" == *"unguided"* ]]; then
            _guidance="unguided"
        elif [[ "$_prompt_basename" == *"guided"* ]]; then
            _guidance="guided"
        else
            _guidance="unknown"
        fi

        local _structure
        if [[ "$MODE" == "struct" ]]; then
            _structure="structured"
        else
            _structure="unstructured"
        fi

        _session_prefix="${VICTIM_TYPE}_${AGENT_TYPE}_${_guidance}_${_structure}"
    fi

    reserve_session_timestamp "$_session_prefix"

    # Get model for display
    local _model_display=""
    case "$AGENT_TYPE" in
        claude)   _model_display="$CLAUDE_MODEL" ;;
        codex)    _model_display="$CODEX_MODEL" ;;
        gemini)   _model_display="$GEMINI_MODEL" ;;
        kimi)     _model_display="$KIMI_MODEL" ;;
        glm)      _model_display="$GLM_MODEL" ;;
        opencode) _model_display="$OPENCODE_MODEL" ;;
    esac

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  AI Agent Attack Automation${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Prompt:     $PROMPT_FILE"
    echo -e "Agent:      $AGENT_TYPE"
    echo -e "Model:      $_model_display"
    echo -e "Victim:     $VICTIM_TYPE"
    echo -e "Mode:       $MODE"
    if [[ -n "$OUTPUT_FORMAT_FILE" ]]; then
        echo -e "Format:     $OUTPUT_FORMAT_FILE"
    fi
    if [[ "$TOKEN_LIMIT" -gt 0 || "$CALL_LIMIT" -gt 0 ]]; then
        echo -e "Limits:"
        [[ "$TOKEN_LIMIT" -gt 0 ]] && echo -e "  Token:    $TOKEN_LIMIT"
        [[ "$CALL_LIMIT" -gt 0 ]] && echo -e "  Calls:    $CALL_LIMIT"
    fi
    echo -e "Session:    $SESSION_TIMESTAMP"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Load environment
    source .env
    export OUTPUT_MODE="$MODE"

    # Export execution limits
    export AGENT_TOKEN_LIMIT="$TOKEN_LIMIT"
    export AGENT_CALL_LIMIT="$CALL_LIMIT"

    # Export model selections
    export CLAUDE_MODEL CODEX_MODEL GEMINI_MODEL KIMI_MODEL GLM_MODEL OPENCODE_MODEL

    # Export custom output format file path (convert to container path)
    if [[ -n "$OUTPUT_FORMAT_FILE" ]]; then
        local format_filename=$(basename "$OUTPUT_FORMAT_FILE")
        local format_realpath=$(realpath "$OUTPUT_FORMAT_FILE")
        local target_realpath=$(realpath "output_formats/$format_filename" 2>/dev/null || echo "")
        if [[ "$format_realpath" != "$target_realpath" ]]; then
            cp "$OUTPUT_FORMAT_FILE" "output_formats/$format_filename"
        fi
        export OUTPUT_FORMAT_FILE="/output_formats/$format_filename"
    fi

    # Configure victim server
    configure_victim

    # Create session-specific output directories
    export SESSION_DIR="results/${SESSION_TIMESTAMP}"
    mkdir -p "${SESSION_DIR}/output"
    mkdir -p "${SESSION_DIR}/api-logs"
    mkdir -p "${SESSION_DIR}/http-logs"
    mkdir -p "${SESSION_DIR}/analysis"
    mkdir -p prompts output_formats

    # Save full prompt to session directory for reproducibility
    local _prompt_file_host="$PROMPT_FILE"
    local _format_file_host="${OUTPUT_FORMAT_FILE}"
    if [[ "$_format_file_host" == /output_formats/* ]]; then
        _format_file_host="output_formats/$(basename "$_format_file_host")"
    fi
    if [[ -z "$_format_file_host" ]]; then
        if [[ "$MODE" == "struct" ]]; then
            _format_file_host="output_formats/example_struct.txt"
        else
            _format_file_host="output_formats/example_report.txt"
        fi
    fi
    {
        echo "# Prompt file: $(basename "$_prompt_file_host")"
        echo "# Output format file: $(basename "$_format_file_host")"
        echo "# Agent: $AGENT_TYPE"
        echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo ""
        cat "$_prompt_file_host"
        echo ""
        echo ""
        cat "$_format_file_host"
    } > "${SESSION_DIR}/prompt.txt"

    # Determine prompt path inside container (parallel-safe - no shared attack.txt)
    resolve_prompt_container_path

    # Create session.json metadata
    create_session_json

    # Build images if needed or requested
    if [[ "$BUILD_IMAGES" == "true" ]] || ! docker images | grep -q "agent-base"; then
        build_images
    fi

    # Generate compose file
    generate_compose "$AGENT_TYPE" "$SESSION_TIMESTAMP"

    # Run the experiment
    run_experiment

    # Cleanup
    if [[ "$KEEP_CONTAINERS" == "false" ]]; then
        log_step "Cleaning up containers..."
        dc down --remove-orphans
        rm -f "$COMPOSE_FILE"
    else
        log_info "Containers kept. Stop with: docker compose -f $(basename "$COMPOSE_FILE") -p $COMPOSE_PROJECT down"
    fi

    # ---- Summary Output ----
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Execution Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Session:       ${BLUE}./${SESSION_DIR}/${NC}"
    echo -e "  Output:      ${BLUE}./${SESSION_DIR}/output/${NC}"
    echo -e "  API Logs:    ${BLUE}./${SESSION_DIR}/api-logs/${NC}"
    echo -e "  HTTP Logs:   ${BLUE}./${SESSION_DIR}/http-logs/${NC}"
    echo -e "  Analysis:    ${BLUE}./${SESSION_DIR}/analysis/${NC}"
    echo ""

    echo "Session contents:"
    ls -la "./${SESSION_DIR}/output/" 2>/dev/null || echo "  (no output yet)"
    echo ""

    echo "Metrics summary:"
    if [[ -f "./${SESSION_DIR}/analysis/summary.json" ]]; then
        python3 -c "
import sys, json
try:
    with open('./${SESSION_DIR}/analysis/summary.json') as f:
        d = json.load(f)
    if d.get('note'):
        print(f\"  Note: {d['note']}\")
    for m, v in d.get('models', {}).items():
        cost = v.get('total_cost_usd', 0)
        cost_str = f\", \${cost:.4f}\" if cost > 0 else ''
        print(f\"  {m}: {v['calls']} calls, {v['total_tokens']} tokens{cost_str}\")
    t = d.get('totals', {})
    total_cost = t.get('total_cost_usd', 0)
    cost_str = f\", \${total_cost:.4f}\" if total_cost > 0 else ''
    print(f\"  TOTAL: {t.get('total_calls', 0)} calls, {t.get('total_tokens', 0)} tokens{cost_str}\")
except Exception as e:
    print(f\"  Error: {e}\")
" 2>/dev/null || echo "  (no metrics available)"
    else
        echo "  (no metrics summary generated)"
    fi
    echo ""

    echo "Attack classification:"
    if [[ -f "./${SESSION_DIR}/analysis/attack_summary.json" ]]; then
        python3 -c "
import json
try:
    with open('./${SESSION_DIR}/analysis/attack_summary.json') as f:
        d = json.load(f)
    total = d.get('total_requests', 0)
    attacks = d.get('attack_requests', 0)
    ratio = d.get('attack_ratio', 0)
    print(f'  Total requests: {total}, Attack requests: {attacks} ({ratio*100:.1f}%)')
    dist = d.get('attack_distribution', {})
    for family, count in sorted(dist.items(), key=lambda x: -x[1]):
        if family != 'others' and count > 0:
            print(f'    {family}: {count}')
except Exception as e:
    print(f'  Error: {e}')
" 2>/dev/null || echo "  (classification failed)"
    else
        echo "  (no attack classification available)"
    fi
    echo ""

    echo "Challenge verification:"
    if [[ -f "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json" ]]; then
        local solved_count total_count
        solved_count=$(jq -r '.solved_count // 0' "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json" 2>/dev/null || echo "0")
        total_count=$(jq -r '.total_challenges // 0' "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json" 2>/dev/null || echo "0")

        if [[ "$solved_count" != "0" ]]; then
            echo -e "  ${GREEN}${AGENT_TYPE}${NC}: $solved_count/$total_count challenges solved"
            jq -r '.solved_challenges[]? | "    - \(.name) (\(.category))"' \
                "./${SESSION_DIR}/analysis/${AGENT_TYPE}_challenges.json" 2>/dev/null | head -5
            local more_count=$((solved_count - 5))
            [[ $more_count -gt 0 ]] && echo "    ... and $more_count more"
        else
            echo -e "  ${AGENT_TYPE}: 0/$total_count challenges solved"
        fi
    else
        echo "  (no challenge verification for this victim type)"
    fi
    echo ""
}

main "$@"
