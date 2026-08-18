import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { matchesKey, Key } from "@earendil-works/pi-tui";
import { unlinkSync } from "node:fs";

/** Strip ANSI escape sequences for width calculations. */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Truncate `str` so its visible width is at most `max`, appending "…" if cut. */
function truncateVisible(str: string, max: number): string {
  if (max <= 0) return "";
  // Fast path: no ANSI codes and already short enough
  if (stripAnsi(str).length <= max) return str;

  let visible = 0;
  let i = 0;
  while (i < str.length && visible < max - 1) {
    if (str[i] === "\x1b") {
      const end = str.indexOf("m", i);
      if (end !== -1) { i = end + 1; continue; }
    }
    visible++;
    i++;
  }
  return str.slice(0, i) + "…";
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("remove", {
    description: "Select and delete past sessions",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("This command requires interactive mode", "error");
        return;
      }

      const sessions = await SessionManager.list(ctx.cwd);
      const currentFile = ctx.sessionManager.getSessionFile();

      // Filter out the current session
      const deletable = sessions.filter((s) => s.path !== currentFile);

      if (deletable.length === 0) {
        ctx.ui.notify("No other sessions to remove", "info");
        return;
      }

      // Sort by modified date, most recent first
      deletable.sort(
        (a, b) => b.modified.getTime() - a.modified.getTime()
      );

      const result = await ctx.ui.custom<string[] | null>(
        (tui, theme, _keybindings, done) => {
          let cursor = 0;
          const selected = new Set<number>();
          let showPreview = false;

          /** Wrap text to fit within `maxW` columns, returning wrapped lines. */
          const wrapText = (text: string, maxW: number): string[] => {
            if (maxW <= 0) return [""];
            const result: string[] = [];
            // Split by existing newlines first
            for (const paragraph of text.split("\n")) {
              if (paragraph.length === 0) {
                result.push("");
                continue;
              }
              let remaining = paragraph;
              while (remaining.length > maxW) {
                // Try to break at a space
                let breakAt = remaining.lastIndexOf(" ", maxW);
                if (breakAt <= 0) breakAt = maxW;
                result.push(remaining.slice(0, breakAt));
                remaining = remaining.slice(breakAt).trimStart();
              }
              if (remaining.length > 0) result.push(remaining);
            }
            return result;
          };

          const render = (width: number): string[] => {
            const lines: string[] = [];

            if (showPreview) {
              // ── Preview mode ──
              const s = deletable[cursor];
              const name = s.name || s.firstMessage?.slice(0, 80) || s.id;
              const date = s.modified.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              lines.push(
                theme.bold("Preview: ") + theme.fg("accent", name)
              );
              lines.push(
                theme.fg("dim", `Modified: ${date}  ·  ${s.messageCount} message(s)`)
              );
              lines.push(theme.fg("dim", "─".repeat(Math.min(width - 2, 72))));

              // Show session content preview from allMessagesText
              const previewText = s.allMessagesText || s.firstMessage || "(empty session)";
              const maxPreviewW = Math.min(width - 4, 100);
              const maxPreviewLines = 20;
              const wrapped = wrapText(previewText, maxPreviewW);

              for (let l = 0; l < Math.min(wrapped.length, maxPreviewLines); l++) {
                lines.push("  " + wrapped[l]);
              }
              if (wrapped.length > maxPreviewLines) {
                lines.push(
                  theme.fg("dim", `  … ${wrapped.length - maxPreviewLines} more line(s)`)
                );
              }

              lines.push("");
              lines.push(
                theme.fg("dim", "Press Tab or ← to go back")
              );
              return lines;
            }

            // ── Selection list mode ──
            lines.push(
              theme.bold("Select sessions to remove") +
                theme.fg(
                  "dim",
                  "  (Space: toggle, A: all, N: none, Tab: preview, Enter: confirm, Esc: cancel)"
                )
            );
            lines.push("");

            // Calculate visible window for long lists
            const maxVisible = Math.max(5, Math.min(deletable.length, 20));
            let startIdx = 0;
            if (deletable.length > maxVisible) {
              startIdx = Math.max(0, Math.min(cursor - Math.floor(maxVisible / 2), deletable.length - maxVisible));
            }
            const endIdx = Math.min(startIdx + maxVisible, deletable.length);

            if (startIdx > 0) {
              lines.push(theme.fg("dim", `  ↑ ${startIdx} more above`));
            }

            for (let i = startIdx; i < endIdx; i++) {
              const s = deletable[i];
              const isSelected = selected.has(i);
              const isCursor = i === cursor;

              const checkbox = isSelected
                ? theme.fg("success", "[✓]")
                : theme.fg("dim", "[ ]");
              const pointer = isCursor ? theme.fg("accent", "❯ ") : "  ";

              const date = s.modified.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              const name = s.name || s.firstMessage?.slice(0, 60) || s.id;
              const label = isCursor ? theme.bold(name) : name;
              const datePart = theme.fg("dim", ` (${date})`);
              const msgCount = theme.fg("dim", ` [${s.messageCount}]`);

              const line = `${pointer}${checkbox} ${label}${datePart}${msgCount}`;
              lines.push(truncateVisible(line, width - 1));
            }

            if (endIdx < deletable.length) {
              lines.push(theme.fg("dim", `  ↓ ${deletable.length - endIdx} more below`));
            }

            lines.push("");
            lines.push(
              theme.fg("dim", `${selected.size} session(s) selected`)
            );

            return lines;
          };

          const comp = {
            render(width: number) {
              return render(width);
            },
            handleInput(data: string) {
              if (showPreview) {
                // In preview mode: Tab or left arrow goes back
                if (data === "\t" || matchesKey(data, Key.left)) {
                  showPreview = false;
                } else if (matchesKey(data, "escape")) {
                  showPreview = false;
                }
                return true;
              }

              if (matchesKey(data, Key.up)) {
                if (cursor > 0) cursor--;
              } else if (matchesKey(data, Key.down)) {
                if (cursor < deletable.length - 1) cursor++;
              } else if (data === "\t" || matchesKey(data, Key.right)) {
                // Open preview for current session
                showPreview = true;
              } else if (data === " ") {
                if (selected.has(cursor)) {
                  selected.delete(cursor);
                } else {
                  selected.add(cursor);
                }
              } else if (data === "a" || data === "A") {
                // Select all
                for (let i = 0; i < deletable.length; i++) selected.add(i);
              } else if (data === "n" || data === "N") {
                // Select none
                selected.clear();
              } else if (matchesKey(data, "return")) {
                if (selected.size === 0) {
                  done(null);
                } else {
                  done(
                    Array.from(selected).map((i) => deletable[i].path)
                  );
                }
              } else if (matchesKey(data, "escape")) {
                done(null);
              }
              return true;
            },
            invalidate() {},
          };

          return comp;
        }
      );

      if (!result || result.length === 0) {
        ctx.ui.notify("No sessions removed", "info");
        return;
      }

      const ok = await ctx.ui.confirm(
        "Confirm deletion",
        `Delete ${result.length} session(s)? This cannot be undone.`
      );

      if (!ok) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      let removed = 0;
      for (const path of result) {
        try {
          unlinkSync(path);
          removed++;
        } catch (e: any) {
          ctx.ui.notify(`Failed to delete ${path}: ${e.message}`, "error");
        }
      }

      ctx.ui.notify(`Removed ${removed} session(s)`, "info");
    },
  });
}
