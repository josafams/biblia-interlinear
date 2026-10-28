# Publicação nas lojas (fase 7)

Tudo o que a Play Store pede, pronto para copiar, e os passos que só o dono da conta pode fazer. A política de privacidade fica em `web/privacidade.html` e é publicada com o site.

## Antes de enviar (checklist)

- [x] E-mail de contato: `devjosafa@gmail.com` (na política de privacidade e na ficha da loja).
- [ ] Chave de upload criada e cadastrada nos segredos do GitHub (ver [APPS.md](APPS.md#pelo-github-sem-instalar-nada)); o AAB da release **app-android** sai assinado.
- [ ] Tela de consentimento OAuth do Google em **produção** (abaixo).
- [ ] Cliente OAuth **Android** com o SHA-1 da chave de assinatura do Google Play (abaixo) — sem isso, o login com Google não funciona no app baixado da loja.
- [ ] Imagens da ficha: `make store` gera tudo em `build/store/` (e as da ficha em inglês em `build/store/en/`).
- [ ] Teste fechado com 12 testadores por 14 dias (contas pessoais criadas depois de 13/11/2023).

## Ficha da loja

| Campo | Valor |
| --- | --- |
| Nome do app (até 30) | Bíblia Interlinear |
| Descrição curta (até 80) | Hebraico, aramaico e grego palavra por palavra, com a Bíblia Livre |
| Categoria | Livros e referências |
| Tags | Bíblia, Estudo bíblico, Referência |
| Site | <https://josafams.github.io/biblia-interlinear/> |
| Política de privacidade | <https://josafams.github.io/biblia-interlinear/privacidade.html> |
| E-mail | `devjosafa@gmail.com` |
| Ícone | `build/store/icon-512.png` (512×512) |
| Imagem de destaque | `build/store/feature.png` (1024×500) |
| Capturas de celular | `build/store/phone-1.png` a `phone-6.png` (1080×1920) |

### Descrição completa

```text
A Bíblia inteira, os 66 livros, palavra por palavra no original: hebraico e aramaico no Antigo Testamento e grego no Novo. Cada palavra traz a transliteração, a pronúncia aproximada em português, o número Strong, a análise gramatical e uma glosa em português, e abaixo de cada versículo vem o texto corrido da Bíblia Livre (BLIVRE).

MODOS DE LEITURA
• Bíblia: só a Bíblia Livre, em parágrafos, para ler como uma Bíblia comum
• Original: o hebraico ou o grego corrido
• Original e Bíblia Livre, lado a lado
• Interlinear: cada palavra com a sua glosa
• Estudo: com pronúncia e análise gramatical
• Personalizado: você escolhe o que aparece

ESTUDO
• Toque numa palavra para abrir o verbete: origem, significado em português, pronúncia, análise gramatical e como a Bíblia Livre traduz aquela palavra
• "Sobre o livro": resumo, autoria, data, pessoas, linha do tempo e versículos-chave dos 66 livros
• Tema de cada capítulo e léxico do capítulo
• Ouvir o versículo ou a palavra em voz alta

ANOTAÇÕES
• Marque versículos, trechos ou palavras com cinco cores
• Notas, favoritos e etiquetas, com busca e filtros
• Caderno de estudo em PDF com tudo o que você anotou

CONTA GOOGLE (OPCIONAL)
Para quem quiser, o login com Google guarda as anotações numa pasta privada do app no seu próprio Google Drive e as sincroniza entre o celular e o computador. Com a conta, "Meu progresso" mostra os capítulos lidos, o tempo de leitura, os dias seguidos e planos como "Bíblia em 1 ano". Sem login, tudo funciona e fica só no aparelho.

LIVRE E SEM ANÚNCIOS
Sem anúncios, sem cadastro e sem coleta de dados pelo projeto. Funciona sem internet. O texto original vem de fontes abertas (Westminster Leningrad Codex pelo Open Scriptures, SBL Greek New Testament com a morfologia do MorphGNT, dicionário de Strong) e a tradução é a Bíblia Livre, de licença livre. O código e os dados estão no GitHub.

As glosas e o léxico em português são do projeto, gerados por alinhamento com a Bíblia Livre e em revisão contínua; correções são bem-vindas pelo GitHub.
```

### Em inglês (Play Console › Ficha principal › Gerenciar traduções › inglês)

O app tem as duas línguas (o seletor fica em Aparência); a ficha em inglês leva as imagens de `node scripts/store_assets.mjs --lang en` (em `build/store/en/`) e o site `…/biblia-interlinear/en/`.

| Campo | Valor |
| --- | --- |
| Nome do app (até 30) | Bíblia Interlinear |
| Descrição curta (até 80) | Hebrew, Aramaic and Greek word by word, with the Berean Standard Bible |
| Site | <https://josafams.github.io/biblia-interlinear/en/> |
| Imagens | `build/store/en/` (as mesmas medidas da ficha em português) |

```text
The whole Bible, all 66 books, word by word in the original: Hebrew and Aramaic in the Old Testament and Greek in the New. Each word comes with its transliteration, an approximate pronunciation, the Strong's number, the grammatical analysis and an English gloss, and under each verse is the running text of the Berean Standard Bible (BSB).

READING MODES
• Bible: only the BSB, in paragraphs, to read like an ordinary Bible
• Original: the running Hebrew or Greek
• Original and BSB, side by side
• Interlinear: each word with its gloss
• Study: with pronunciation and grammatical analysis
• Custom: you choose what shows

STUDY
• Tap a word to open its entry: origin, meaning, pronunciation, grammatical analysis and how the BSB translates that word elsewhere
• "About the book": summary, authorship, date, people, timeline and key verses for all 66 books
• A theme for each chapter and the chapter's lexicon
• Questions on the text at the end of each chapter, to think about or discuss in a group
• Listen to the verse or the word read aloud

NOTES
• Highlight verses, passages or words with five colors
• Notes, bookmarks and tags, with search and filters
• A study notebook in PDF with everything you wrote

GOOGLE ACCOUNT (OPTIONAL)
If you want, signing in with Google keeps your notes in a private app folder in your own Google Drive and syncs them between phone and computer. With the account, "My progress" shows the chapters read, reading time, streaks and plans like "Bible in a year". Without signing in, everything works and stays on the device.

FREE AND WITHOUT ADS
No ads, no sign-up and no data collected by the project. Works offline. The original text comes from open sources (the Westminster Leningrad Codex from Open Scriptures, the SBL Greek New Testament with the MorphGNT morphology, Strong's dictionary) and the translation is the Berean Standard Bible, in the public domain. The code and the data are on GitHub.

The English glosses are the project's, made by alignment with the BSB and under continuous review; corrections are welcome on GitHub. The app is also in Portuguese, with the Bíblia Livre.
```

## Conteúdo do app (Play Console › Política › Conteúdo do app)

| Pergunta | Resposta |
| --- | --- |
| Anúncios | Não contém anúncios |
| Acesso ao app | Todas as funções estão disponíveis sem acesso especial. Observação para a revisão: o login com Google é opcional e usa a própria conta Google do revisor (sincronização e Meu progresso) |
| Classificação de conteúdo (IARC) | Categoria "Referência, notícias ou educação"; nenhuma violência, sexo, linguagem imprópria, drogas, jogos de azar, compras ou interação entre usuários |
| Público-alvo | 13 anos ou mais (fora do programa Famílias, que tem regras próprias) |
| App de notícias | Não |
| Apps governamentais, financeiros, de saúde | Não |

### Segurança dos dados

O projeto não tem servidor e não recebe nada. Mas, com o login opcional, as anotações e o progresso saem do aparelho para o Google Drive da própria pessoa, e a Play Store conta como "coletado" qualquer dado que o app transmite para fora do aparelho. A forma mais segura de responder é declarar esses dados:

| Pergunta | Resposta |
| --- | --- |
| O app coleta ou compartilha dados? | Sim (coleta) |
| Os dados são criptografados em trânsito? | Sim (HTTPS, direto com o Google) |
| A pessoa pode pedir para apagar os dados? | Sim — no app ("Apagar meus dados do Google Drive") e pelo Drive; link: `…/privacidade.html#apagar` |
| Atividade no app › Outros conteúdos gerados pelo usuário | Coletado; não compartilhado; opcional; finalidade: funcionalidade do app (anotações e notas sincronizadas no Drive da pessoa) |
| Atividade no app › Outras ações | Coletado; não compartilhado; opcional; finalidade: funcionalidade do app (progresso de leitura, preferências de leitura) |
| Informações pessoais (nome, e-mail) | Não coletado: o nome e o e-mail da conta Google ficam só no aparelho, para mostrar com qual conta a pessoa entrou |
| Localização, contatos, fotos, áudio, identificadores, dados financeiros, saúde | Não coletado |

Os lembretes (lembrete de leitura e versículo do dia) são notificações locais, agendadas no próprio aparelho: não transmitem dado nenhum e não entram na Segurança dos dados. O app declara `POST_NOTIFICATIONS` (pedida só quando a pessoa liga um lembrete) e `RECEIVE_BOOT_COMPLETED` (reagendar depois de reiniciar), e retira `SCHEDULE_EXACT_ALARM`, então não há declaração de alarme exato a fazer.

## Google: tela de consentimento em produção

Enquanto a tela de consentimento estiver em "Teste", só os e-mails cadastrados como testadores conseguem entrar. Para liberar para todos ([Google Cloud Console › Google Auth Platform](https://console.cloud.google.com/auth/overview)):

1. **Branding:** nome "Bíblia Interlinear", e-mail de suporte, logotipo (`build/store/icon-512.png`, opcional), página inicial `https://josafams.github.io/biblia-interlinear/`, política de privacidade `…/privacidade.html`.
2. **Domínios autorizados:** `josafams.github.io`. O Google pede que o domínio seja verificado no [Search Console](https://search.google.com/search-console) com a mesma conta: escolha "Prefixo do URL" com `https://josafams.github.io/biblia-interlinear/` e o método "Arquivo HTML"; o arquivo baixado vai para `web/` e é publicado junto com o site (o build copia arquivos `google*.html` de `web/`).
3. **Público-alvo › Publicar app** (de "Teste" para "Em produção"). Os escopos usados (`openid`, `email`, `profile`, `drive.appdata`) são **não sensíveis**, então não há verificação demorada do Google; a análise da marca costuma levar poucos dias.

## Google: login no app baixado da Play Store

O Google reconhece o app Android pelo pacote e pelo SHA-1 da chave que assina o APK. A Play Store reassina o app com uma chave própria (Assinatura de apps do Google Play), então o cliente OAuth criado com a chave de teste não vale para o app da loja.

1. No Play Console, abra **Testar e lançar › Configuração › Integridade do app › Assinatura de apps** e copie o **SHA-1 do certificado da chave de assinatura do app**.
2. No Google Cloud Console, em **Clientes**, crie mais um cliente do tipo **Android** com o pacote `liberta.bibliainterlinear` e esse SHA-1.
3. Para testar o AAB antes da loja (instalado pelo `bundletool`), crie também um cliente Android com o SHA-1 da **chave de upload** (`keytool -list -v -keystore upload.jks`).

Não é preciso mudar nada no código: no Android, o Google escolhe o cliente pelo pacote e pela assinatura.

## Teste fechado

1. Play Console › **Testar e lançar › Teste fechado** › criar faixa, enviar o AAB da release **app-android**.
2. Lista de testadores por e-mail (pelo menos 12; convide 15 ou mais) e envie o link de participação.
3. Os 14 dias contam a partir do momento em que a versão está disponível e há 12 testadores inscritos; peça para usarem o app de verdade nesses dias. Depois, **Painel › Solicitar acesso à produção**.

## iOS (depois)

A App Store pede um Mac com Xcode e a conta Apple Developer (US$ 99/ano). O projeto `ios/` já compila; o login com Google no iOS ainda precisa de um plugin nativo equivalente ao do Android.
