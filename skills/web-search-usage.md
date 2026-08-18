---
name: web-search-usage
description: Reminder for how to perform web searches. When the user asks to search the web or look something up online, follow these instructions instead of guessing tool names.
---

# Web Search Usage

## Important

When `pi-web-access` is installed, it provides a `web_search` tool. Before using it:

1. **Check your available tools first.** If `web_search` is listed among your tools, use it directly.
2. **If `web_search` is NOT in your tool list**, fall back to `curl` commands in bash:
   - GitHub search: `curl -s "https://api.github.com/search/repositories?q=..." | jq ...`
   - General search: Use public APIs like DuckDuckGo, GitHub API, or other REST APIs via `curl`.
3. **Never call a tool name that isn't in your available tool set.** This causes an error and wastes a turn.
