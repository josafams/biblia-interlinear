# Web, Android, iOS e EPUB

Um único conteúdo (`web/template.html` + dados da Bíblia inteira) gera as saídas:

| Saída | Onde fica | Como é gerada |
|---|---|---|
| Banco do corpus (66 livros, 443 mil palavras, glosas, léxico) | `saida/biblia.sqlite` | `scripts/corpus.py` e `scripts/glosar.py` (o `build.sh` roda se o banco não existir, ou com `REFAZER=1`) |
| Dados em JSON | `saida/dados/` — `livros.json`, `cap/<LIVRO>/<n>.json` (1.189 capítulos), `lex/H.json` e `lex/G.json` | `scripts/exportar.py` (chamado pelo `build_web.mjs`) |
| Dados que o site e o app carregam | `saida/web/dados/` — os mesmos dados em `.js`, que funcionam também abrindo o `index.html` direto do disco | idem |
| Web instalável (PWA, funciona offline) | `saida/web/` | `scripts/build.sh` |
| Página única com capítulos de amostra | `saida/previa.html` | `scripts/build.sh` |
| App Android | `android/` (projeto Capacitor) | `npx cap sync android` copia `saida/web` para dentro do app |
| App iOS | `ios/` (projeto Capacitor, Swift Package Manager) | `npx cap sync ios` |
| EPUB (um por livro, 66) | `saida/epub/` | `scripts/build_epub.py` (validados com epubcheck) |
| PDF (um por livro, 66, A4) | `saida/pdf/` | `scripts/build_pdf.py` + `scripts/imprimir_pdf.mjs` (Chromium do Playwright); `PDF=0 scripts/build.sh` pula |

Sequência completa a partir do zero:

```sh
scripts/baixar_fontes.sh      # fontes abertas (hebraico, grego, BLIVRE, Strong, Dodson)
REFAZER=1 scripts/build.sh    # corpus, glosas (≈1 min), revisões, web e prévia
```

Na página, o endereço guarda a posição (`index.html#JHN.3.16`), e a última posição lida fica salva no aparelho. O app lê cada capítulo e o léxico sob demanda, de arquivos locais, então funciona sem internet.

O código da página detecta onde está rodando:

- **No app (Android ou iOS):** a voz (hebraico no AT, grego no NT, ambos na pronúncia moderna) vem do motor de texto para fala do sistema, pelo plugin `@capacitor-community/text-to-speech`. Isso resolve o problema do navegador embutido do Android, que não tem voz. No Android, o botão "voltar" fecha painéis e o verbete antes de sair do app; se faltar a voz, aparece o botão "Instalar vozes".
- **No navegador:** a voz vem da Web Speech API, e um service worker guarda tudo para uso sem internet.

Fontes tipográficas ficam dentro do app e do site (Fontsource, SIL OFL 1.1): nada é baixado do Google.

## Identificador do app

O identificador é `liberta.bibliainterlinear` e o nome exibido é "Bíblia Interlinear". Depois da primeira publicação na Play Store ou na App Store, o identificador não pode mais mudar. Se precisar trocar antes disso:

```sh
scripts/trocar_app_id.sh novo.identificador
npx cap sync
```

## Android

### Pelo GitHub (sem instalar nada)

O workflow `.github/workflows/android.yml` roda a cada envio para a branch `main`:

1. gera web, página e EPUB;
2. copia a web para o projeto Android;
3. compila um **APK de teste** (`app-debug.apk`, instalável direto no celular) e um **AAB** para a Play Store;
4. deixa os arquivos para download na aba **Actions** do repositório (artefato `android`).

Para o AAB sair assinado, cadastre em *Settings › Secrets and variables › Actions*:

| Segredo | Conteúdo |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | o arquivo `.jks` em base64 (`base64 -w0 upload.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | senha do arquivo |
| `ANDROID_KEY_ALIAS` | apelido da chave |
| `ANDROID_KEY_PASSWORD` | senha da chave |

Criar a chave de upload (uma vez; guarde o arquivo e as senhas em local seguro):

```sh
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

O `versionCode` usa o número da execução do workflow, então cada build novo pode ser enviado à Play Store.

### No computador (Android Studio)

Requisitos: Node 22, Python 3.11+ (com `pip install eflomal` para refazer as glosas), JDK 21, Android Studio.

```sh
npm ci
scripts/build.sh
npx cap sync android
npx cap open android      # abre no Android Studio; use Run para instalar no celular
```

Para gerar o AAB assinado localmente, defina as mesmas variáveis (`ANDROID_KEYSTORE_PATH` com o caminho do `.jks`, mais as senhas e o alias) antes de `./gradlew bundleRelease` dentro de `android/`.

### Play Store

1. Conta de desenvolvedor no Google Play Console.
2. Contas pessoais criadas depois de 13/11/2023: teste fechado com pelo menos 12 testadores por 14 dias seguidos antes de pedir a produção.
3. Política de privacidade: publique a versão web (abaixo) e use o endereço `…/privacidade.html`. Preencha o e-mail de contato em `web/privacidade.html` antes.
4. Ficha da loja: ícone 512×512 (`saida/web/icones/icone-512.png`), capturas de tela, descrição.
5. Formulário de segurança dos dados: o app não coleta dados; preferências ficam só no aparelho.

## iOS

O projeto já está em `ios/`, com os mesmos plugins. Para compilar e publicar é preciso um Mac com Xcode e uma conta Apple Developer.

```sh
npm ci
scripts/build.sh
npx cap sync ios
npx cap open ios          # abre no Xcode
```

O workflow `.github/workflows/ios.yml` (manual) confere se o projeto compila para o simulador num Mac do GitHub, sem assinatura.

## Web

O workflow `.github/workflows/web.yml` publica `saida/web` no GitHub Pages a cada envio para a `main` (ative em *Settings › Pages › Source: GitHub Actions*). No celular, o navegador oferece "Instalar app" ou "Adicionar à tela inicial".

Para testar localmente:

```sh
scripts/build.sh
python3 -m http.server -d saida/web 8000   # abra http://localhost:8000
```

## Ícones e telas de abertura

Desenhados em `web/icones/*.svg` (a letra ב, primeira de *Bereshit*, sobre as linhas de uma interlinear). Para regenerar os arquivos do Android e do iOS:

```sh
node scripts/icones_nativos.mjs
```

## Dependências do app

| Pacote | Licença |
|---|---|
| @capacitor/core, android, ios, app, cli | MIT |
| @capacitor-community/text-to-speech | MIT |
| @fontsource (Noto Serif Hebrew, Gentium Book Plus, Literata, IBM Plex Mono, Atkinson Hyperlegible) | SIL OFL 1.1 (os textos das licenças vão junto em `saida/web/fonts/`) |
