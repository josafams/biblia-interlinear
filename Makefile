# Comandos do projeto (os mesmos no computador e no CI). `make` sozinho lista tudo.
.DEFAULT_GOAL := help
.PHONY: help setup data web test test-data test-web lint format coverage videos-check build

help: ## Lista os comandos
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

setup: ## Instala dependências de Node e Python e os ganchos do pre-commit
	npm ci
	python3 -m pip install -r requirements-dev.txt
	pre-commit install

data: ## Baixa as fontes abertas e gera corpus, glosas, revisões e o site
	[ -d fontes-dados ] || scripts/baixar_fontes.sh
	python3 scripts/corpus.py
	python3 scripts/glosar.py
	python3 scripts/revisar.py > /dev/null
	node scripts/build_web.mjs

web: ## Gera só o site (saida/web)
	node scripts/build_web.mjs

test: test-data test-web ## Roda todos os testes

test-data: ## Testes de dados, scripts, EPUB e PDF (pytest)
	python3 -m pytest

test-web: ## Testes do site no navegador (Playwright)
	npx playwright test

lint: ## Linters de todas as linguagens
	npx prettier --check .
	npx eslint .
	ruff check .
	ruff format --check .
	npx markdownlint-cli2 "**/*.md"
	shellcheck scripts/*.sh

format: ## Formata o código (Prettier e Ruff)
	npx prettier --write .
	ruff check --fix .
	ruff format .

coverage: ## Cobertura do Python: o pipeline de dados e os testes
	python3 -m coverage erase
	python3 -m coverage run -p scripts/corpus.py > /dev/null
	python3 -m coverage run -p scripts/glosar.py > /dev/null
	python3 -m coverage run -p scripts/revisar.py > /dev/null
	python3 -m pytest --cov --cov-append --cov-report=
	python3 -m coverage combine --append
	python3 -m coverage report
	python3 -m coverage xml -o saida/coverage.xml

videos-check: ## Confere se os roteiros dos vídeos ainda funcionam (sem gravar)
	node scripts/videos/gravar.mjs --verificar

build: ## Gera tudo: dados, site, EPUB e PDF
	scripts/build.sh
