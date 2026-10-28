# Comandos do projeto. `make` sozinho lista tudo.
#
# Fora de um contêiner, cada comando roda dentro do Docker (compose.yaml), então só o Docker precisa estar
# instalado. Para rodar direto no computador, com Node, Python etc. instalados: make LOCAL=1 <comando>.
# Sem o make (Windows): biblia <comando>   ou   docker compose run --rm dev make <comando>
.DEFAULT_GOAL := help

# Dentro do contêiner (IN_DOCKER vem da imagem) ou com LOCAL=1, os comandos rodam aqui mesmo
ifneq ($(IN_DOCKER)$(LOCAL),)
RUN_HERE := 1
endif

COMPOSE := docker compose
DEV := $(COMPOSE) run --rm dev

.PHONY: help docker-build docker-clean shell serve android \
        setup data web dev test test-data test-unit test-web lint format coverage videos videos-check store build \
        epub pdf check-data android-apk

help: ## Lista os comandos
	@echo "Uso: make <comando>   (roda no Docker; LOCAL=1 roda direto no computador)"
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

# ---------------------------------------------------------------- Docker (no computador)

docker-build: ## Monta as imagens do Docker (a primeira vez demora; refaça quando o Dockerfile mudar)
	$(COMPOSE) build dev
	$(COMPOSE) --profile android build android

docker-clean: ## Apaga contêineres, imagens e volumes do projeto (node_modules e cache do Gradle)
	$(COMPOSE) --profile android down --rmi local --volumes

shell: ## Abre um terminal dentro do contêiner, com todas as ferramentas
	$(DEV) bash

serve: ## Abre o site gerado em http://localhost:8000
	$(COMPOSE) up web

android: ## Compila o APK de teste e o AAB do app Android (gera o site antes, se faltar)
	$(COMPOSE) --profile android run --rm android make android-apk

# ---------------------------------------------------------------- comandos do projeto

ifndef RUN_HERE
# Fora do contêiner: o mesmo comando, dentro do Docker
setup data web test test-data test-web lint format coverage videos videos-check store build epub pdf check-data:
	$(DEV) make $@ $(if $(ONLY),ONLY="$(ONLY)")
android-apk:
	$(COMPOSE) --profile android run --rm android make android-apk
else

setup: ## Instala as dependências de Node (no Docker, só se o package-lock mudou) e os ganchos do pre-commit
	npm ci
	-pre-commit install

data: ## Baixa as fontes abertas e gera corpus, glosas, revisões e o site
	[ -d sources ] || scripts/download_sources.sh
	python3 scripts/corpus.py
	python3 scripts/make_glosses.py
	python3 scripts/review.py > /dev/null
	npm run build:web

web: ## Gera só o site (build/web); precisa do banco gerado por `make data`
	npm run build:web

dev: ## Refaz o site a cada arquivo salvo (com `make serve` em outro terminal)
	npm run dev

check-data: ## Confere os arquivos editados à mão em data/ (temas, léxico, correções, perguntas)
	python3 scripts/check_data.py

test: test-data test-unit test-web ## Roda todos os testes

test-data: ## Testes de dados, scripts, EPUB e PDF (pytest)
	python3 -m pytest

test-unit: ## Testes de unidade do núcleo em TypeScript (Vitest)
	npx vitest run

test-web: ## Testes do site no navegador (Playwright)
	npx playwright test

lint: ## Linters de todas as linguagens
	npx prettier --check .
	npx eslint .
	npx stylelint "src/styles/*.css"
	npm run check
	node scripts/dev/i18n_check.mjs
	ruff check .
	ruff format --check .
	mypy
	npx markdownlint-cli2 "**/*.md"
	shellcheck scripts/*.sh docker/*.sh

format: ## Formata o código (Prettier e Ruff)
	npx prettier --write .
	ruff check --fix .
	ruff format .

coverage: ## Cobertura do Python: o pipeline de dados e os testes
	python3 -m coverage erase
	python3 -m coverage run -p scripts/corpus.py > /dev/null
	python3 -m coverage run -p scripts/make_glosses.py > /dev/null
	python3 -m coverage run -p scripts/review.py > /dev/null
	python3 -m pytest --cov --cov-append --cov-report=
	python3 -m coverage report
	python3 -m coverage xml -o build/coverage.xml

videos: ## Grava os vídeos "Como usar" em build/videos (ex.: make videos ONLY=27)
	node scripts/videos/gravar.mjs $(ONLY)

videos-check: ## Confere se os roteiros dos vídeos ainda funcionam (sem gravar)
	node scripts/videos/gravar.mjs --verificar

store: web ## Imagens da ficha da Play Store em build/store (e em inglês, em build/store/en)
	node scripts/store_assets.mjs
	node scripts/store_assets.mjs --lang en

epub: ## Gera os EPUB em build/epub (BOOKS_LANG=en: em inglês, em build/epub/en)
	python3 scripts/build_epub.py --lang $(or $(BOOKS_LANG),pt)

pdf: ## Gera os PDF em build/pdf (BOOKS_LANG=en: em inglês, em build/pdf/en)
	python3 scripts/build_pdf.py --lang $(or $(BOOKS_LANG),pt)

build: ## Gera tudo: dados, site, EPUB e PDF
	scripts/build.sh

android-apk: ## (no contêiner android) Copia o site para o app e compila o APK e o AAB
	[ -f build/web/index.html ] || $(MAKE) data
	npx cap sync android
	# as páginas estáticas para a busca (biblia/, lexico/, sitemaps) são só do site
	cd android/app/src/main/assets/public && rm -rf biblia lexico sitemap*.xml robots.txt
	cd android && ./gradlew --no-daemon assembleDebug bundleRelease
	@echo "APK: android/app/build/outputs/apk/debug/  ·  AAB: android/app/build/outputs/bundle/release/"
endif
