/**
 * Pi Notify Extension
 *
 * Shows a macOS notification banner with Pi icon and plays a sound when Pi is done.
 * Visible even when the terminal is not in focus.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function notifyDarwin(): void {
	const { spawn } = require("child_process");
	const { join } = require("path");
	const { homedir } = require("os");
	const bin = join(homedir(), ".pi", "agent", "extensions", "PiAgent.app", "Contents", "MacOS", "terminal-notifier");
	const child = spawn(bin, ["-title", "Pi", "-message", "Ready for input", "-sound", "Glass"], {
		detached: true,
		stdio: "ignore",
	});
	child.unref();
}

function notifyOther(): void {
	try {
		const { openSync, writeFileSync, closeSync } = require("fs");
		const fd = openSync("/dev/tty", "w");
		writeFileSync(fd, "\x07");
		closeSync(fd);
	} catch {
		process.stderr.write("\x07");
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_settled", async () => {
		if (process.platform === "darwin") {
			notifyDarwin();
		} else {
			notifyOther();
		}
	});
}
