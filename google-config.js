// IDs de cliente OAuth do projeto no Google Cloud (públicos: não há segredo neste fluxo).
// Como criar: docs/GOOGLE.md. Enquanto webClientId estiver vazio, o login não aparece no site.
// No app Android o login usa o pacote + SHA-1 da chave de assinatura (cliente "Android" no Google Cloud),
// por isso não precisa de ID aqui.
window.GOOGLE_CONFIG = {
  webClientId: "677022464454-rr87nr0oknsb4itj1nptcdnhdgmafj73.apps.googleusercontent.com",
  // só para referência (o app Android não envia este ID): cliente "Android", pacote liberta.bibliainterlinear,
  // SHA-1 47:9D:0D:FF:06:C7:3C:2F:39:0B:E9:E7:43:14:73:81:80:0F:1E:BD (android/app/debug.keystore)
  androidClientIdTeste: "677022464454-g7ari58o2ruvt4elaj57pm8a74esh330.apps.googleusercontent.com"
};
