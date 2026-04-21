#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

import { consumeMarkers, readInbox } from "./lib/notify.mjs";
import { SESSION_ID_ENV } from "./lib/tracked-jobs.mjs";

function readHookInput() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function describeMarker(marker) {
  const parts = [`${marker.jobId} (${marker.status})`];
  if (marker.title) {
    parts.push(`"${marker.title}"`);
  } else if (marker.kind) {
    parts.push(marker.kind);
  }
  const label = parts.join(" ");
  const detail = marker.status === "failed" || marker.status === "cancelled"
    ? marker.errorMessage || marker.status
    : marker.summary;
  return detail ? `- ${label} — ${detail}` : `- ${label}`;
}

function formatReminder(markers) {
  const lines = [];
  lines.push("<system-reminder>");
  lines.push(
    `Codex background job${markers.length === 1 ? "" : "s"} finished since the last turn. Fetch results with \`/codex:result <job-id>\` before acting on them.`
  );
  for (const marker of markers) {
    lines.push(describeMarker(marker));
    lines.push(`  /codex:result ${marker.jobId}`);
  }
  lines.push("</system-reminder>");
  return lines.join("\n");
}

async function main() {
  const input = readHookInput();
  const sessionId = input.session_id || process.env[SESSION_ID_ENV];
  if (!sessionId) {
    return;
  }

  const markers = readInbox(sessionId);
  if (markers.length === 0) {
    return;
  }

  process.stdout.write(`${formatReminder(markers)}\n`);
  consumeMarkers(markers);
}

main().catch((error) => {
  // Never fail the hook — a broken notifier must not block the user's prompt.
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(0);
});
