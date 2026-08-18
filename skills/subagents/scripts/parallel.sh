#!/usr/bin/env bash
# parallel.sh - Run multiple pi sub-agents in parallel, each with isolated context.
#
# Usage:
#   parallel.sh [options] "task 1" "task 2" "task 3" ...
#
# Options (applied to every sub-agent):
#   -m <model>     Model pattern
#   -d <dir>       Working directory (default: current dir)
#   -t <tools>     Comma-separated tool allowlist
#   -T <level>     Thinking level
#   -j <n>         Max concurrent agents (default: 4)
#
# Output: prints each agent's result under a "=== Agent N ===" header once all
# agents finish. Exit code is non-zero if any agent failed.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL=""
DIR="$PWD"
TOOLS=""
THINK=""
MAXJOBS=4

while getopts "m:d:t:T:j:" opt; do
  case "$opt" in
    m) MODEL="$OPTARG" ;;
    d) DIR="$OPTARG" ;;
    t) TOOLS="$OPTARG" ;;
    T) THINK="$OPTARG" ;;
    j) MAXJOBS="$OPTARG" ;;
    *) echo "Unknown option" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

if [[ $# -eq 0 ]]; then
  echo "Error: no tasks given." >&2
  exit 2
fi

RESULTS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pi-subagents.XXXXXX")"
trap 'rm -rf "$RESULTS_DIR"' EXIT

SPAWN_ARGS=()
[[ -n "$MODEL" ]] && SPAWN_ARGS+=(-m "$MODEL")
[[ -n "$TOOLS" ]] && SPAWN_ARGS+=(-t "$TOOLS")
[[ -n "$THINK" ]] && SPAWN_ARGS+=(-T "$THINK")
SPAWN_ARGS+=(-d "$DIR")

i=0
pids=()
for task in "$@"; do
  i=$((i + 1))
  # Throttle concurrency
  while [[ "$(jobs -rp | wc -l)" -ge "$MAXJOBS" ]]; do sleep 0.5; done
  (
    if "$SCRIPT_DIR/spawn.sh" "${SPAWN_ARGS[@]}" -o "$RESULTS_DIR/$i.out" "$task"; then
      : > "$RESULTS_DIR/$i.ok"
    fi
  ) &
  pids+=($!)
done

wait

FAILED=0
for n in $(seq 1 "$i"); do
  echo "=== Agent $n ==="
  cat "$RESULTS_DIR/$n.out" 2>/dev/null || echo "(no output)"
  if [[ ! -f "$RESULTS_DIR/$n.ok" ]]; then
    echo "--- Agent $n FAILED ---"
    FAILED=1
  fi
  echo
done

exit "$FAILED"
