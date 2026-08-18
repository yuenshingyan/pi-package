---
name: subagents
description: Spawn pi sub-agents with isolated context windows to delegate tasks or run multiple tasks in parallel. Use when a job can be split into independent subtasks (research, refactors across files, multi-part analysis), when a task would pollute or overflow the current context, or when the user asks for parallel/background agents.
---

# Sub-agents

Delegate work to child `pi` processes. Each sub-agent:

- Runs non-interactively (`-p`) with **no session persistence** (`--no-session`) — fully isolated context.
- Loads no extensions or skills (fast startup, no recursion).
- Inherits the standard tools (read, bash, edit, write) unless restricted.
- Prints its final answer to stdout, which you collect.

Scripts live relative to this file in `scripts/`.

## Single sub-agent

```bash
scripts/spawn.sh "Summarize the architecture of this repo. Report file paths and key modules."
```

Options:

| Flag | Meaning |
|------|---------|
| `-m <model>` | Model pattern (e.g. `*haiku*` for cheap recon) |
| `-d <dir>`   | Working directory for the agent |
| `-t <tools>` | Tool allowlist, e.g. `read,bash` for read-only agents |
| `-s <text>`  | Extra system-prompt text (agent persona/constraints) |
| `-T <level>` | Thinking level: `off`..`max` |
| `-o <file>`  | Write output to a file |

## Parallel sub-agents

```bash
scripts/parallel.sh \
  "Find all authentication-related code. Return file paths and a summary." \
  "List every public API endpoint and its handler." \
  "Audit Cargo.toml/package.json dependencies for outdated versions."
```

- Runs up to 4 agents concurrently (`-j <n>` to change).
- Waits for all, then prints each result under `=== Agent N ===` headers.
- Same `-m`, `-d`, `-t`, `-T` options as spawn.sh, applied to every agent.
- Exit code is non-zero if any agent failed.

## Writing good sub-agent tasks

Sub-agents start with **zero context** — they don't know your conversation. Each task prompt must be self-contained:

1. State the goal, the working directory/files involved, and any constraints.
2. Tell the agent exactly what to report back (e.g. "Return a list of file paths with one-line explanations").
3. For read-only research, pass `-t read,bash` so the agent cannot modify files.
4. For parallel **editing** tasks, make sure tasks touch disjoint files to avoid conflicts.

## Patterns

- **Fan-out research**: split a large codebase question into N parallel read-only scouts, then synthesize their reports yourself.
- **Context offload**: delegate a verbose task (log analysis, large-file summarization) so the noise stays out of your context; only the final report comes back.
- **Pipeline**: run a scout first, feed its output into a worker task prompt, then optionally a reviewer.
- **Cheap recon**: use `-m '*haiku*'` (or another small model) for search/summarize tasks; keep the default model for implementation.
