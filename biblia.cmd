@echo off
rem Roda um comando do projeto no Docker, sem precisar do make no Windows.
rem Exemplos: biblia test, biblia lint, biblia data, biblia shell, biblia serve, biblia android
rem Sem nada depois de "biblia", lista os comandos.
cd /d "%~dp0"
if "%~1"=="" goto ajuda
if /i "%~1"=="docker-build" goto montar
if /i "%~1"=="docker-clean" goto limpar
if /i "%~1"=="shell" goto terminal
if /i "%~1"=="serve" goto site
if /i "%~1"=="android" goto android
docker compose run --rm dev make %*
exit /b %errorlevel%
:ajuda
docker compose run --rm dev make help
exit /b %errorlevel%
:montar
docker compose build dev && docker compose --profile android build android
exit /b %errorlevel%
:limpar
docker compose --profile android down --rmi local --volumes
exit /b %errorlevel%
:terminal
docker compose run --rm dev bash
exit /b %errorlevel%
:site
docker compose up web
exit /b %errorlevel%
:android
docker compose --profile android run --rm android make android-apk
exit /b %errorlevel%
