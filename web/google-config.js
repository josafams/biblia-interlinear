// IDs de cliente OAuth do projeto no Google Cloud (públicos: não há segredo neste fluxo).
// Como criar: docs/GOOGLE.md. Enquanto webClientId estiver vazio, o login não aparece no site.
// No app Android o login usa o pacote + SHA-1 da chave de assinatura (cliente "Android" no Google Cloud),
// por isso não precisa de ID aqui.
window.GOOGLE_CONFIG = {
  webClientId: "677022464454-rr87nr0oknsb4itj1nptcdnhdgmafj73.apps.googleusercontent.com"
};
