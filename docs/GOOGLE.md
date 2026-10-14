# Login com Google e Google Drive

O login é opcional e serve só para guardar as anotações na **pasta oculta do app no Google Drive da própria pessoa** (escopo `drive.appdata`). O projeto não tem servidor: o app fala direto com o Google.

- Código do site: `web/conta.js` (Google Identity Services, modelo de token) e `web/google-config.js` (ID do cliente Web).
- Código do Android: `android/app/src/main/java/liberta/bibliainterlinear/ContaGooglePlugin.java` (API de autorização do Google Play services).
- Testes: `tests/web/conta.spec.mjs` (o Google é simulado; nada sai para a internet).

Enquanto `webClientId` estiver vazio, o bloco de login não aparece no site. No app Android ele aparece, mas só funciona depois do cliente Android estar cadastrado (passo 4).

## Configuração no Google Cloud (uma vez, grátis)

1. **Projeto.** Em <https://console.cloud.google.com/>, crie um projeto (ex.: "Biblia Interlinear").
2. **API do Drive.** Em *APIs e serviços › Biblioteca*, ative a **Google Drive API**.
3. **Tela de consentimento** (*Google Auth Platform › Branding*):
   - Nome do app: Bíblia Interlinear; e-mail de suporte; logotipo (ícone do app, 120×120).
   - Página inicial: `https://josafams.github.io/biblia-interlinear/`
   - Política de privacidade: `https://josafams.github.io/biblia-interlinear/privacidade.html`
   - Domínio autorizado: `josafams.github.io`
   - Público (*Audience*): **Externo**. Enquanto estiver "Em teste", só os e-mails cadastrados em *Usuários de teste* conseguem entrar (até 100). Para abrir a todos, clique em *Publicar app*.
   - Escopos (*Data access*): `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` e `.../auth/drive.appdata`. Todos são **não sensíveis**: basta a verificação de marca (logo, domínio e política), sem auditoria de segurança.
4. **IDs de cliente** (*Clients › Create client*):
   - **Aplicativo da Web** — Origens JavaScript autorizadas: `https://josafams.github.io` (e, para testar no computador, `http://localhost:8767`). Não precisa de URI de redirecionamento. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) para `web/google-config.js`.
   - **Android (APK de teste)** — Pacote `liberta.bibliainterlinear`, SHA-1 da chave de teste que está no repositório (`android/app/debug.keystore`):
     `47:9D:0D:FF:06:C7:3C:2F:39:0B:E9:E7:43:14:73:81:80:0F:1E:BD`
   - **Android (loja)** — mesmo pacote, com o SHA-1 da chave de envio (`ANDROID_KEYSTORE_BASE64`) e, quando o app estiver na Play Store, o SHA-1 da *chave de assinatura do app* que aparece em *Play Console › Integridade do app*.
   - O SHA-1 de uma chave sai com: `keytool -list -v -keystore arquivo.jks`
5. **Verificação de marca.** Confirme o domínio `josafams.github.io` no Google Search Console (com a mesma conta) e envie o pedido em *Verification Center*. Dá para usar e testar antes da verificação, com os usuários de teste.

Os IDs de cliente são públicos (não há segredo neste fluxo) e podem ficar no repositório.

## Como funciona

- **Site:** ao tocar em "Entrar com Google", o script `accounts.google.com/gsi/client` é carregado e abre a janela do Google. O token de acesso dura 1 hora e fica só na memória; nome, e-mail e foto ficam no aparelho para mostrar a conta. Ao voltar ao site, aparece "Reconectar" (um toque).
- **Android:** na primeira vez aparece a janela do Google para escolher a conta e permitir; depois o app renova o token sozinho ao abrir.
- **Drive:** o app cria `conta.json` na pasta do app, com a lista de aparelhos conectados. A sincronização das anotações (fase 5) usa a mesma pasta.
- **Sair:** o app esquece a conta neste aparelho (no site também revoga o token). As anotações continuam no aparelho. Para retirar a permissão de vez: <https://myaccount.google.com/connections>.
