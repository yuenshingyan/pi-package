/**
 * Pi Notify Extension
 *
 * Sends a native terminal notification and audio bell when Pi agent is done.
 * Writes directly to /dev/tty to bypass TUI stdout capture.
 * Supports multiple terminal protocols:
 * - OSC 777: Ghostty, iTerm2, WezTerm, rxvt-unicode
 * - OSC 99: Kitty
 * - Windows toast: Windows Terminal (WSL)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { writeFileSync, openSync, closeSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __extensionDir = dirname(fileURLToPath(import.meta.url));

function writeTTY(data: string): void {
	try {
		const fd = openSync("/dev/tty", "w");
		writeFileSync(fd, data);
		closeSync(fd);
	} catch {
		// Fallback to stderr (also bypasses TUI stdout)
		process.stderr.write(data);
	}
}

function windowsToastScript(title: string, body: string): string {
	const type = "Windows.UI.Notifications";
	const mgr = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
	const template = `[${type}.ToastTemplateType]::ToastText01`;
	const toast = `[${type}.ToastNotification]::new($xml)`;
	return [
		`${mgr} > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
		`$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body}')) > $null`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier('${title}').Show(${toast})`,
	].join("; ");
}

function notifyOSC777(title: string, body: string): void {
	writeTTY(`\x1b]777;notify;${title};${body}\x1b\\`);
}

function notifyOSC99(title: string, body: string): void {
	writeTTY(`\x1b]99;i=1:d=0;${title}\x1b\\`);
	writeTTY(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

function notifyWindows(title: string, body: string): void {
	const { execFile } = require("child_process");
	execFile("powershell.exe", ["-NoProfile", "-Command", windowsToastScript(title, body)]);
}

function bell(): void {
	writeTTY("\x07");
}

function notifyMacOS(title: string, body: string): void {
	const { execFile } = require("node:child_process");
	const path = require("node:path");
	const piNotifier = path.join(__extensionDir, "PiNotifier.app", "Contents", "MacOS", "terminal-notifier");
	execFile(piNotifier, [
		"-title", title,
		"-message", body,
		"-sound", "Glass",
	], (err: Error | null) => {
		if (err) {
			// Fallback to osascript if PiNotifier.app is not available
			execFile("osascript", ["-e", `display notification "${body}" with title "${title}" sound name "Glass"`]);
		}
	});
}

function notify(title: string, body: string): void {
	bell();
	if (process.env.WT_SESSION) {
		notifyWindows(title, body);
	} else if (process.env.KITTY_WINDOW_ID) {
		notifyOSC99(title, body);
	} else if (process.platform === "darwin") {
		notifyMacOS(title, body);
	} else {
		notifyOSC777(title, body);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_settled", async (_event, ctx) => {
		notify("Pi", "Ready for input");
		ctx.ui.setStatus("notify", "π Ready for input");
	});

	pi.on("agent_start", async (_event, ctx) => {
		ctx.ui.setStatus("notify", "");
	});
}
