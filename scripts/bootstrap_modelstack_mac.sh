#!/bin/zsh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REQUIRED_NODE_MAJOR=22
REQUIRED_PNPM_VERSION="10.20.0"
DEFAULT_MODELSTACK_COMMAND="recommend"
MODELSTACK_COMMAND="${MODELSTACK_COMMAND:-$DEFAULT_MODELSTACK_COMMAND}"
BOOTSTRAP_VERBOSE="${MODELSTACK_BOOTSTRAP_VERBOSE:-0}"
BOOTSTRAP_LOG=""

print_header() {
  printf '\n%s\n' "============================================================"
  printf '%s\n' "$1"
  printf '%s\n' "============================================================"
}

print_step() {
  printf '\n%s\n' "$2"
}

init_bootstrap_log() {
  BOOTSTRAP_LOG="$(mktemp -t modelstack-bootstrap.XXXXXX.log)"
}

run_logged() {
  if [[ "$BOOTSTRAP_VERBOSE" == "1" ]]; then
    "$@"
  else
    "$@" >>"$BOOTSTRAP_LOG" 2>&1
  fi
}

fail_with_log() {
  local message="$1"
  printf '\n%s\n' "$message"
  if [[ -n "$BOOTSTRAP_LOG" ]]; then
    printf '%s\n' "Details were saved to: $BOOTSTRAP_LOG"
  fi
  exit 1
}

ensure_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "This launcher is for macOS. Run ModelStack manually on this OS."
    exit 1
  fi
}

ensure_network_tool() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to bootstrap Homebrew. Install curl and try again."
    exit 1
  fi
}

install_homebrew() {
  local homebrew_script
  print_step "bootstrap" "Installing Homebrew."
  ensure_network_tool
  homebrew_script="$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" ||
    fail_with_log "Failed to download the Homebrew installer."
  run_logged env NONINTERACTIVE=1 /bin/bash -c "$homebrew_script" ||
    fail_with_log "Homebrew installation failed."
}

setup_homebrew_shellenv() {
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

ensure_homebrew() {
  if ! command -v brew >/dev/null 2>&1; then
    install_homebrew
    setup_homebrew_shellenv
  else
    setup_homebrew_shellenv
  fi

  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew installation did not complete successfully."
    exit 1
  fi
}

node_major_version() {
  if ! command -v node >/dev/null 2>&1; then
    echo "0"
    return
  fi

  node -p "process.versions.node.split('.')[0]"
}

ensure_node() {
  local node_major
  node_major="$(node_major_version)"

  if [[ "$node_major" -lt "$REQUIRED_NODE_MAJOR" ]]; then
    print_step "bootstrap" "Installing Node.js ${REQUIRED_NODE_MAJOR}."
    run_logged brew install node@22 || fail_with_log "Node.js installation failed."

    if [[ -x "$(brew --prefix node@22)/bin/node" ]]; then
      export PATH="$(brew --prefix node@22)/bin:$PATH"
    fi
  fi

  node_major="$(node_major_version)"
  if [[ "$node_major" -lt "$REQUIRED_NODE_MAJOR" ]]; then
    echo "Node.js ${REQUIRED_NODE_MAJOR}+ is still unavailable after install."
    exit 1
  fi
}

ensure_pnpm() {
  if command -v corepack >/dev/null 2>&1; then
    print_step "bootstrap" "Preparing package manager."
    run_logged corepack enable || fail_with_log "Corepack enable failed."
    run_logged corepack prepare "pnpm@${REQUIRED_PNPM_VERSION}" --activate || fail_with_log "pnpm activation failed."
  elif ! command -v pnpm >/dev/null 2>&1; then
    print_step "bootstrap" "Installing pnpm."
    run_logged npm install -g "pnpm@${REQUIRED_PNPM_VERSION}" || fail_with_log "pnpm installation failed."
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm could not be installed."
    exit 1
  fi
}

install_dependencies() {
  print_step "install" "Preparing ModelStack."
  cd "$PROJECT_DIR"

  if [[ -f pnpm-lock.yaml ]]; then
    run_logged pnpm install --frozen-lockfile || run_logged pnpm install || fail_with_log "Dependency installation failed."
  else
    run_logged pnpm install || fail_with_log "Dependency installation failed."
  fi
}

build_modelstack() {
  print_step "build" "Building ModelStack."
  cd "$PROJECT_DIR"
  run_logged pnpm build || fail_with_log "Build failed."
}

run_modelstack() {
  print_step "run" "Starting ModelStack."
  cd "$PROJECT_DIR"
  node dist/index.js ${=MODELSTACK_COMMAND}
}

finish_message() {
  if [[ -t 0 ]]; then
    printf '\n%s\n' "ModelStack finished. Press Return to close this window."
    read -r
  fi
}

main() {
  print_header "ModelStack macOS Launcher"
  init_bootstrap_log
  ensure_macos
  print_step "check" "Checking your system."
  ensure_homebrew
  ensure_node
  ensure_pnpm
  install_dependencies
  build_modelstack
  run_modelstack
  finish_message
}

main "$@"
