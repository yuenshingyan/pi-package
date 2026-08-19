/**
 * Pi Notify Extension
 *
 * Plays a sound and shows footer status when Pi agent is done.
 * - macOS: plays system sound via afplay
 * - Other: terminal bell via /dev/tty
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function bell(): void {
	try {
		const { openSync, writeFileSync, closeSync } = require("fs");
		const fd = openSync("/dev/tty", "w");
		writeFileSync(fd, "\x07");
		closeSync(fd);
	} catch {
		process.stderr.write("\x07");
	}
}

function playSound(): void {
	const { spawn } = require("child_process");
	if (process.platform === "darwin") {
		const child = spawn("afplay", ["/System/Library/Sounds/Glass.aiff"], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
	} else {
		bell();
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_settled", async (_event, ctx) => {
		playSound();
		ctx.ui.setStatus("notify", "π Ready for input");
	});

	pi.on("agent_start", async (_event, ctx) => {
		ctx.ui.setStatus("notify", "");
	});
}
