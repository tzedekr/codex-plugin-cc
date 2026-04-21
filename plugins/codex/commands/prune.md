---
description: Remove stranded Codex state shards from other workspaces
argument-hint: '[--older-than-days N] [--dry-run]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" prune "$ARGUMENTS"`

Present the command output to the user verbatim. Do not summarize the list of removed or kept shards; the user needs to see the exact names to audit cleanup.
