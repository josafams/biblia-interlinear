# Segurança

## Como relatar uma falha

Não abra uma issue pública com os detalhes. Use o relato privado do GitHub:
**Security › Report a vulnerability** neste repositório
(<https://github.com/josafams/biblia-interlinear/security/advisories/new>).

Diga o que acontece, como reproduzir e qual parte é afetada (site, app Android/iOS, sincronização com o Google Drive,
EPUB/PDF ou scripts).

## O que está no escopo

- O site publicado (<https://josafams.github.io/biblia-interlinear/>) e o app `liberta.bibliainterlinear`.
- O acesso à pasta do app no Google Drive (escopo `drive.appdata`) e os dados guardados no aparelho.
- Os workflows do GitHub e os scripts deste repositório.

Os IDs de cliente OAuth em `web/google-config.js` são públicos por natureza e não são uma falha.

## Versões com suporte

Só a versão atual da `main` (e o que ela publica no site e na release `app-android`) recebe correções.
