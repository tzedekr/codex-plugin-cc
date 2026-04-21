import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PLUGIN_DATA_ENV = "CLAUDE_PLUGIN_DATA";
const FALLBACK_INBOX_ROOT = path.join(os.tmpdir(), "codex-companion-inbox");

export function resolveInboxRoot() {
  const pluginDataDir = process.env[PLUGIN_DATA_ENV];
  return pluginDataDir ? path.join(pluginDataDir, "inbox") : FALLBACK_INBOX_ROOT;
}

export function resolveSessionInbox(sessionId) {
  if (!sessionId) {
    return null;
  }
  return path.join(resolveInboxRoot(), sessionId);
}

function nowIso() {
  return new Date().toISOString();
}

export function writeCompletionMarker(sessionId, marker) {
  if (!sessionId || !marker || !marker.jobId) {
    return null;
  }

  const inboxDir = resolveSessionInbox(sessionId);
  if (!inboxDir) {
    return null;
  }

  fs.mkdirSync(inboxDir, { recursive: true });

  const payload = {
    jobId: marker.jobId,
    status: marker.status ?? "unknown",
    kind: marker.kind ?? "task",
    title: marker.title ?? null,
    summary: marker.summary ?? null,
    errorMessage: marker.errorMessage ?? null,
    workspaceRoot: marker.workspaceRoot ?? null,
    completedAt: marker.completedAt ?? nowIso()
  };

  const filePath = path.join(inboxDir, `${marker.jobId}.json`);
  // Unique tmp suffix so concurrent writers (worker safety-net + handleCancel,
  // racing on the same jobId) don't clobber each other's tmp file and trigger
  // ENOENT on rename. Final rename is last-writer-wins on filePath, which is
  // acceptable — both markers signal "job ended" to the consumer.
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
  return filePath;
}

export function readInbox(sessionId) {
  const inboxDir = resolveSessionInbox(sessionId);
  if (!inboxDir || !fs.existsSync(inboxDir)) {
    return [];
  }

  const entries = fs
    .readdirSync(inboxDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"));

  const markers = [];
  for (const entry of entries) {
    const filePath = path.join(inboxDir, entry.name);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      markers.push({ ...parsed, _path: filePath });
    } catch {
      // Skip malformed markers silently; they will be swept on next consume.
    }
  }

  markers.sort((left, right) => String(left.completedAt ?? "").localeCompare(String(right.completedAt ?? "")));
  return markers;
}

export function consumeMarkers(markers) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return;
  }
  for (const marker of markers) {
    const filePath = marker?._path;
    if (!filePath) {
      continue;
    }
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Already gone — treat as consumed.
    }
  }
}
