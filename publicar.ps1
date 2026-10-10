# Primeira publicação no GitHub. Rode UMA vez, no PowerShell, dentro desta pasta:
#   powershell -ExecutionPolicy Bypass -File .\publicar.ps1
# Cria o repositório público "biblia-interlinear", envia o código (main) e o site (gh-pages),
# liga o GitHub Pages e publica os 66 EPUBs e 66 PDFs na página Releases.
# O envio da main dispara o workflow Android, que publica o APK e o AAB na release "app-android".
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$repo = "biblia-interlinear"

gh auth status
$owner = gh api user -q .login
Write-Host "Conta: $owner"

gh repo create $repo --public --source . --remote origin --description "Bíblia interlinear hebraico/aramaico/grego–português com a Bíblia Livre (BLIVRE): site, app Android, EPUB e PDF"

# o site primeiro (o workflow do Android usa o ramo gh-pages como conteúdo do app)
git push -u origin gh-pages
git push -u origin main

# GitHub Pages a partir do ramo gh-pages
gh api -X POST "repos/$owner/$repo/pages" -f "source[branch]=gh-pages" -f "source[path]=/" | Out-Null
gh repo edit "$owner/$repo" --homepage "https://$owner.github.io/$repo/"

# EPUBs e PDFs (gerados em saida\epub e saida\pdf) na página Releases
$arquivos = @((Get-ChildItem saida\epub\*.epub).FullName) + @((Get-ChildItem saida\pdf\*.pdf).FullName)
$notas = "Os 66 livros da Bíblia Interlinear em EPUB (Kindle e outros leitores: cada palavra do original é uma nota com glosa, gramática e significado) e em PDF A4 (cartões das palavras com a BLIVRE abaixo de cada versículo). Gerados em 10/10/2026."
gh release create livros-2026-10-10 --title "EPUB e PDF dos 66 livros (10/10/2026)" --notes $notas @arquivos

Write-Host ""
Write-Host "Pronto."
Write-Host "Repositório: https://github.com/$owner/$repo"
Write-Host "Site (pode levar 1-2 minutos para aparecer): https://$owner.github.io/$repo/"
Write-Host "APK: https://github.com/$owner/$repo/releases/tag/app-android (sai quando o workflow Android terminar, ~10 min)"
