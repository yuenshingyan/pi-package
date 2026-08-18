#!/usr/bin/env bash
# spawn.sh - Run a single pi sub-agent with isolated context and print its final output.
#
# Usage:
#   spawn.sh [options] "task prompt"
#
# Options:
#   -m <model>     Model pattern (e.g. "anthropic/claude-sonnet-4-5", "*haiku*")
#   -d <dir>       Working directory for the sub-agent (default: current dir)
#   -t <tools>     Comma-separated tool allowlist (e.g. "read,bash")
#   -s <text>      Extra system-prompt text appended for this agent
#   -T <level>     Thinking level: off|minimal|low|medium|high|xhigh|max
#   -o <file>      Write output to file instead of stdout
#
# The sub-agent runs non-interactively (-p), with no session persistence and
# no extensions, so its context is fully isolated from the parent session.

set -euo pipefail

MODEL=""
DIR="$PWD"
TOOLS=""
SYS=""
THINK=""
OUT=""

while getopts "m:d:t:s:T:o:" opt; do
  case "$opt" in
    m) MODEL="$OPTARG" ;;
    d) DIR="$OPTARG" ;;
    t) TOOLS="$OPTARG" ;;
    s) SYS="$OPTARG" ;;
    T) THINK="$OPTARG" ;;
    o) OUT="$OPTARG" ;;
    *) echo "Unknown option" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

TASK="${1:-}"
if [[ -z "$TASK" ]]; then
  echo "Error: no task prompt given." >&2
  exit 2
fi

ARGS=(-p --no-session --no-extensions --no-skills)
[[ -n "$MODEL" ]] && ARGS+=(--model "$MODEL")
[[ -n "$TOOLS" ]] && ARGS+=(--tools "$TOOLS")
[[ -n "$SYS"   ]] && ARGS+=(--append-system-prompt "$SYS")
[[ -n "$THINK" ]] && ARGS+=(--thinking "$THINK")

if [[ -n "$OUT" ]]; then
  (cd "$DIR" && pi "${ARGS[@]}" "$TASK") >"$OUT" 2>&1
else
  (cd "$DIR" && pi "${ARGS[@]}" "$TASK")
fi
