#!/usr/bin/env bash
# Publica build/web no ramo gh-pages (GitHub Pages) e envia ao GitHub.
# O envio também dispara o workflow Android, que compila o app com este mesmo conteúdo.
# Uso: scripts/publish_web.sh ["mensagem do commit"]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f build/web/index.html ] || { echo "Gere o site antes: scripts/build.sh"; exit 1; }
MSG="${1:-Site: $(date +%Y-%m-%d)}"
TMP="$(mktemp -d)"
git worktree add -q "$TMP" gh-pages 2>/dev/null || git worktree add -q -B gh-pages "$TMP" origin/gh-pages
# Vídeos "Como usar": se esta máquina não gravou (build/videos vazio), mantém os que já estão publicados.
if ! ls build/web/videos/*.mp4 >/dev/null 2>&1 && [ -d "$TMP/videos" ]; then KEEP="$(mktemp -d)"; cp -r "$TMP/videos" "$KEEP/"; fi
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r build/web/. "$TMP"/
cp LICENSE "$TMP"/
if [ -n "${KEEP:-}" ]; then rm -rf "$TMP/videos"; cp -r "$KEEP/videos" "$TMP/"; rm -rf "$KEEP"; fi
touch "$TMP/.nojekyll"
git -C "$TMP" add -A
git -C "$TMP" commit -q -m "$MSG" || echo "Nada mudou no site."
git -C "$TMP" push origin gh-pages
git worktree remove --force "$TMP"
echo "Site enviado para o ramo gh-pages."
