# Ambiente no Docker

Com o [Docker](https://docs.docker.com/get-docker/) instalado (no Windows e no Mac, o Docker Desktop), todos os comandos do projeto rodam em contêineres: não é preciso instalar Node, Python, Chromium, Java nem o Android SDK no computador.

## Primeira vez

```bash
make docker-build      # ou, no Windows sem make: biblia docker-build
make data              # baixa as fontes abertas e gera o banco, as glosas e o site
make serve             # abre o site em http://localhost:8000
```

`make docker-build` demora alguns minutos na primeira vez (baixa as imagens, o Chromium e o Android SDK). Refaça quando `docker/`, `requirements-dev.txt` ou o `Dockerfile` mudarem; mudanças no `package-lock.json` são instaladas sozinhas na próxima execução.

## Comandos

`make help` lista todos. Os principais:

| Comando | O que faz |
| --- | --- |
| `make data` | fontes abertas → corpus, glosas, revisões e site |
| `make web` | só o site (`build/web`) |
| `make dev` | refaz o site a cada arquivo salvo em `src/` ou `web/` (use junto com `make serve`) |
| `make test` | testes de dados (pytest) e do site no navegador (Playwright) |
| `make lint` / `make format` | linters e formatação de todas as linguagens |
| `make check-data` | confere os arquivos editados à mão em `data/` |
| `make build` | tudo: dados, site, EPUB e PDF |
| `make videos ONLY=27` | grava vídeos "Como usar" (sem `ONLY`, todos) |
| `make store` | imagens da ficha da Play Store |
| `make android` | APK de teste e AAB em `android/app/build/outputs/` |
| `make serve` | site em <http://localhost:8000> |
| `make shell` | terminal dentro do contêiner, com todas as ferramentas |
| `make docker-clean` | apaga as imagens e os volumes do projeto |

No **Windows sem o make**, o mesmo comando vai depois de `biblia` (o arquivo `biblia.cmd` na raiz): `biblia test`, `biblia shell`, `biblia android`. Também funciona direto: `docker compose run --rm dev make test`.

## Como funciona

- `docker/Dockerfile` monta a imagem **dev**: Node 22, Python com as dependências de `requirements-dev.txt`, Chromium do Playwright, ffmpeg, qpdf, pdftotext, epubcheck, ShellCheck e git.
- `docker/android.Dockerfile` monta a imagem **android** a partir da dev, com JDK 21 e o Android SDK (plataforma 36).
- `compose.yaml` monta a pasta do projeto em `/app`; o `node_modules` fica num volume do Docker (os pacotes de Linux não se misturam com os do computador) e o cache do Gradle em outro.
- O `Makefile` percebe se está dentro do contêiner (variável `IN_DOCKER`): fora dele, cada comando chama `docker compose run --rm dev make <comando>`. Com `LOCAL=1`, roda direto no computador.
- Para assinar o AAB no `make android`, defina `ANDROID_KEYSTORE_PATH` (caminho dentro do projeto, por exemplo `/app/upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` antes do comando. Nunca envie o `.jks` ao repositório.
- No GitHub, o workflow **Docker** monta as imagens e roda o lint dentro delas a cada mudança nesses arquivos.
