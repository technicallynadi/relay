#!/usr/bin/env bash
# Foolproof launcher. The machine's default `node` may be v17, which Next 15 rejects
# (Next spawns Node even under Bun). This picks the highest installed nvm Node >= 20,
# then runs the given bun script. Usage: ./run.sh [dev|build|start|seed|worker|test]
# Run the live-feed ingestion worker alongside dev:  ./run.sh worker  (in a second shell)
set -euo pipefail

pick=""
if [ -d "$HOME/.nvm/versions/node" ]; then
  while IFS= read -r d; do
    v="$(basename "$d")"; major="${v#v}"; major="${major%%.*}"
    if [ "${major:-0}" -ge 20 ]; then pick="$d/bin"; fi
  done < <(ls -d "$HOME/.nvm/versions/node"/v* 2>/dev/null | sort -V)
fi
[ -n "$pick" ] && export PATH="$pick:$PATH"

echo "▶ node $(node --version 2>&1) · bun $(bun --version) · running '${1:-dev}'"
exec bun run "${1:-dev}"
