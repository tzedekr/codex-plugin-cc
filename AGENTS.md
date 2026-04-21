# Codex Plugin CC — Fork Documentation

`tzedekr/codex-plugin-cc` is a fork of `openai/codex-plugin-cc` that layers a Codex→Claude notification pipeline on top of the upstream plugin. When OpenAI publishes a new release, rebase onto their main and re-apply the overlay.

## Overlay (what diverges from upstream)

Six files carry the notification pipeline. Any upstream rebase must preserve them:

- `plugins/codex/scripts/lib/notify.mjs` — completion-marker writer (new file)
- `plugins/codex/scripts/notify-hook.mjs` — `UserPromptSubmit` drain (new file)
- `plugins/codex/commands/prune.md` — `/codex:prune` doc (new file)
- `plugins/codex/hooks/hooks.json` — adds the `UserPromptSubmit` block pointing at `notify-hook.mjs`
- `plugins/codex/scripts/lib/tracked-jobs.mjs` — calls `writeCompletionMarker` on both success and failure paths
- `plugins/codex/scripts/codex-companion.mjs` — safety marker on abnormal exit in `handleTaskWorker`; completion marker in `handleCancel`

`UPSTREAM_BASE` at repo root records the full SHA of the upstream commit this fork's `main` was last rebased onto (plus the upstream release tag on line 2). The `~/.claude/hooks/codex-upstream-check.sh` hook reads this to detect new OpenAI releases.

## Upstream rebase recipe

When `codex-upstream-check.sh` pushes "new upstream release — rebase needed":

```bash
cd ~/Projects/codex-plugin-cc
git fetch upstream
git branch "backup-pre-$(date +%Y%m%d)" main         # safety bookmark
git checkout main
OVERLAY=$(git rev-parse HEAD)                        # remember the overlay commit
git reset --hard upstream/main
git cherry-pick "$OVERLAY"                           # re-apply overlay
# If the cherry-pick conflicts on tracked-jobs.mjs / codex-companion.mjs /
# hooks.json, resolve by keeping upstream's structural changes AND the
# notification calls. The three new files (notify.mjs, notify-hook.mjs,
# prune.md) should always apply cleanly.
node --check plugins/codex/scripts/codex-companion.mjs
node --check plugins/codex/scripts/lib/tracked-jobs.mjs
node --check plugins/codex/scripts/lib/notify.mjs
node --check plugins/codex/scripts/notify-hook.mjs
python3 -c "import json; json.load(open('plugins/codex/hooks/hooks.json'))"
git rev-parse upstream/main > UPSTREAM_BASE
echo "v<new-tag>" >> UPSTREAM_BASE
git add UPSTREAM_BASE
git commit --amend --no-edit
git push origin main --force-with-lease
```

Reload plugin caches in any running Claude sessions after pushing.

## Watchdog recovery (if Codex hangs)

v1.0.0 had a local activity-watchdog + hard-timer + completion-inference block in `plugins/codex/scripts/codex.mjs` (branch `backup-9c07229`, roughly lines 298–405). v1.0.4 replaced the completion path with `completionTimer`, which is leaner but doesn't cover all the hang modes the watchdog did.

If Codex hang symptoms recur (task stuck in `phase: executing` with no output for several minutes), the recovery path is:

1. `git show backup-9c07229:plugins/codex/scripts/codex.mjs` — pull the watchdog block
2. Reconcile with current `codex.mjs`: the watchdog triggers should coexist with `completionTimer`, not replace it
3. Add a dedicated overlay commit (keep it separate from the notification-pipeline commit for cleaner future rebases)

## Safety branches

- `backup-9c07229` — pre-rebase local state with the custom watchdog
- `upstream-v1.0.4` — upstream v1.0.4 tip at the time of the fork rebase

Keep both until at least one clean upstream rebase cycle has been verified end-to-end.

<claude-mem-context>
# Memory Context

# [codex-plugin-cc] recent context, 2026-04-21 11:24am PDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 4 obs (1,594t read) | 11,059t work | 86% savings

### Apr 21, 2026
223 10:45a 🔵 Codex sandbox blocks all .git directory writes in codex-plugin-cc
224 10:46a 🔵 Codex sandbox workaround: clone to mktemp dir, then operate there
225 10:47a 🔵 Fork main already contains upstream v1.0.4 — merge is a no-op
226 " 🔵 Codex sandbox has zero outbound network — GitHub push/fetch both blocked at DNS

Access 11k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
