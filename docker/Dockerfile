# Imagem de desenvolvimento: tudo o que os comandos do projeto usam (make, Node, Python, Chromium,
# ffmpeg, qpdf, pdftotext, epubcheck, ShellCheck, git). Com ela, só o Docker precisa estar instalado.
# Uso: docker compose run --rm dev make test   (ou `make test`, que chama o Docker sozinho)
FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    IN_DOCKER=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PYTHONDONTWRITEBYTECODE=1

# Ferramentas do sistema. O Python é o 3.11 do Debian (bookworm); a CI usa o 3.12 e o ruff mira o 3.12
# (pyproject.toml), então o código precisa continuar rodando nas duas versões.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-venv python3-dev build-essential \
      git make zip unzip curl ca-certificates \
      ffmpeg qpdf poppler-utils shellcheck epubcheck \
 && rm -rf /var/lib/apt/lists/*

# Python: dependências de desenvolvimento num ambiente próprio (eflomal, pytest, ruff, pre-commit…)
RUN python3 -m venv /opt/venv
COPY requirements-dev.txt /tmp/requirements-dev.txt
RUN pip install -r /tmp/requirements-dev.txt

# Node: dependências do package-lock e o Chromium do Playwright (com as bibliotecas e fontes do sistema)
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci \
 && npx playwright install --with-deps chromium \
 && sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.lock-hash \
 && rm -rf /root/.npm

# O repositório entra por volume em /app; node_modules fica num volume próprio, preenchido por esta imagem
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint && git config --system --add safe.directory /app
ENTRYPOINT ["entrypoint"]
CMD ["bash"]
