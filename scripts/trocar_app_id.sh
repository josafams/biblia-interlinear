#!/usr/bin/env bash
# Troca o identificador do app (ex.: br.com.seudominio.interlinear) no Capacitor,
# no Android e no iOS. Faça isso ANTES da primeira publicação: depois de publicado
# na Play Store ou na App Store, o identificador não pode mais mudar.
# Uso: scripts/trocar_app_id.sh br.com.seudominio.interlinear
set -euo pipefail
cd "$(dirname "$0")/.."
NOVO="${1:?informe o novo id, ex.: br.com.seudominio.interlinear}"
[[ "$NOVO" =~ ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$ ]] || { echo "id inválido: use letras minúsculas, números e pontos"; exit 1; }
ATUAL=$(node -p 'require("./capacitor.config.json").appId')
[ "$ATUAL" = "$NOVO" ] && { echo "já está com $NOVO"; exit 0; }

node -e 'const f="capacitor.config.json",c=require("./"+f);c.appId=process.argv[1];require("fs").writeFileSync(f,JSON.stringify(c,null,2)+"\n")' "$NOVO"

if [ -d android ]; then
  sed -i.bak "s/$ATUAL/$NOVO/g" android/app/build.gradle android/app/src/main/res/values/strings.xml && rm -f android/app/build.gradle.bak android/app/src/main/res/values/strings.xml.bak
  OLD_DIR="android/app/src/main/java/${ATUAL//.//}"; NEW_DIR="android/app/src/main/java/${NOVO//.//}"
  mkdir -p "$NEW_DIR"
  sed "s/^package $ATUAL;/package $NOVO;/" "$OLD_DIR/MainActivity.java" > "$NEW_DIR/MainActivity.java"
  rm "$OLD_DIR/MainActivity.java"
  find android/app/src/main/java -type d -empty -delete
fi
if [ -d ios ]; then
  sed -i.bak "s/PRODUCT_BUNDLE_IDENTIFIER = $ATUAL;/PRODUCT_BUNDLE_IDENTIFIER = $NOVO;/g" ios/App/App.xcodeproj/project.pbxproj && rm -f ios/App/App.xcodeproj/project.pbxproj.bak
fi
echo "Identificador trocado: $ATUAL → $NOVO. Rode: npx cap sync"
