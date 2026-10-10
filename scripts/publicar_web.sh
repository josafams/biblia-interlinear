#!/usr/bin/env bash
# Publica saida/web no ramo gh-pages (GitHub Pages) e envia ao GitHub.
# O envio também dispara o workflow Android, que compila o app com este mesmo conteúdo.
# Uso: scripts/publicar_web.sh ["mensagem do commit"]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f saida/web/index.html ] || { echo "Gere o site antes: scripts/build.sh"; exit 1; }
MSG="${1:-Site: $(date +%Y-%m-%d)}"
TMP="$(mktemp -d)"
git worktree add -q "$TMP" gh-pages 2>/dev/null || git worktree add -q -B gh-pages "$TMP" origin/gh-pages
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r saida/web/. "$TMP"/
touch "$TMP/.nojekyll"
git -C "$TMP" add -A
git -C "$TMP" commit -q -m "$MSG" || echo "Nada mudou no site."
git -C "$TMP" push origin gh-pages
git worktree remove --force "$TMP"
echo "Site enviado para o ramo gh-pages."
