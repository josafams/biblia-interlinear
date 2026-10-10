# Fontes e licenças

Tudo o que o projeto usa precisa ser aberto ou livre de direitos pagos, porque o resultado será distribuído publicamente.

## Em uso hoje (atualizado em 9/10/2026)

| Componente | Fonte | Licença | Obrigação |
|---|---|---|---|
| Hebraico e aramaico, morfologia e mapa de versificação | Open Scriptures Hebrew Bible (morphhb), sobre o Westminster Leningrad Codex | CC BY 4.0 (WLC em domínio público) | Crédito: "Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb" |
| Texto grego | SBL Greek New Testament (SBLGNT), © 2010 Society of Biblical Literature e Logos Bible Software | CC BY 4.0 (desde 2023; o README antigo do MorphGNT ainda cita o EULA anterior) | Crédito e indicação de alterações. Alteração feita: tiramos do texto os sinais do aparato (⸀ ⸂ ⸃ ⟦ ⟧) |
| Rm 16:25–27 em grego | Leitura de WH, Tregelles e NA28 registrada no **aparato** do SBLGNT (o texto principal termina em 16:24); morfologia anotada neste projeto (`dados/grego_suplemento_66-Ro.txt`) | CC BY 4.0 | O app avisa que o trecho vem do aparato |
| Morfologia e lemas gregos | MorphGNT: SBLGNT Edition, J. K. Tauber | CC BY-SA 3.0 | Crédito; dados derivados (glosas gregas, contagens) sob a mesma licença |
| Tradução corrida, AT | Bíblia Livre, revisão de fev. 2018, © Diego Santos, Mario Sérgio e Marco Teles; corpus eBible (BibleNLP) | CC BY 4.0 Brasil | Crédito com autores, link sites.google.com/site/biblialivre, versão e licença; texto reproduzido sem alterações |
| Tradução corrida, NT (e versículos que faltam na de 2018) | Bíblia Livre, edição 2017 (módulo CrossWire PorBLivre 1.0.1), © 2017 os mesmos autores; via scrollmapper/bible_databases | CC BY 3.0 Brasil | Idem. No NT ela traduz o texto crítico (o mesmo do SBLGNT); a de 2018 segue o Textus Receptus |
| Dicionário Strong (transliteração, pronúncia em inglês, origem, significado) | James Strong (1890/1894, domínio público), edição digital Open Scriptures | CC BY-SA | Crédito; o léxico em português (`dados/lexico_pt/`) é adaptação e vai sob CC BY-SA |
| Léxico grego auxiliar (lema → Strong, glosa curta) | Jeffrey Dodson, Greek Lexicon (biblicalhumanities) | Domínio público / CC0 | — |
| Pontos de divisão de 7 versículos (hebraico × numeração das traduções) | Conferidos com o TAHOT (STEPBible) | CC BY 4.0 | Crédito "STEP Bible" (www.STEPBible.org). Nenhum dado do TAHOT é distribuído |
| Glosas palavra a palavra | Alinhamento estatístico com a BLIVRE feito neste projeto com a ferramenta **eflomal** (GPL 3) | Ferramenta usada só no processamento; nada dela é distribuído | As glosas não fazem parte da BLIVRE nem têm endosso dos autores |
| Introduções, temas, traduções do léxico, pronúncia em português, regras de glosa | Feitos para este projeto | a definir pelo autor (sugestão: CC BY-SA 4.0, compatível com o Strong e o MorphGNT) | — |
| Fontes tipográficas | Noto Serif Hebrew, Gentium Book Plus, Literata, IBM Plex Mono, Atkinson Hyperlegible (via Fontsource) | SIL OFL 1.1 | Textos das licenças em `saida/web/fonts/` e na página de créditos do EPUB |
| Apps Android e iOS | Capacitor (core, android, ios, app, cli) e @capacitor-community/text-to-speech | MIT | — |
| Áudio | Voz do aparelho de quem lê (hebraico e grego modernos) | — | Nenhum arquivo de áudio é distribuído |

**Licença do conjunto de dados exportado** (`saida/web/dados/`): por conter derivados do Strong (Open Scriptures) e do MorphGNT, distribuir sob **CC BY-SA**, com os créditos acima.

## Avaliadas e não usadas como dados (conferido em 9/10/2026)

### STEPBible Data (Tyndale House / STEPBible.org)

- Declarado **CC BY 4.0** no README e no cabeçalho de cada arquivo (não há arquivo LICENSE no repositório).
- Crédito obrigatório: **"STEP Bible", com link para www.STEPBible.org**; registrar as mudanças feitas nos dados.
- Pedidos (não são condições da licença, mas convém respeitar): não redistribuir os arquivos brutos (apontar para github.com/STEPBible); enviar correções; projetos com fins lucrativos devem pedir licença individual. **Se o app tiver anúncios ou for pago, escrever para a STEP antes.**

| Arquivo | Usar? | Motivo |
|---|---|---|
| TAHOT, coluna de tradução em inglês (AT) | Sim | CC BY; base para as glosas em português. O arquivo não declara de onde vem essa tradução |
| TAGNT, coluna de tradução em inglês (NT) | Sim | Baseada na Berean Study Bible "com permissão"; a Berean está em domínio público desde 30/04/2023 |
| TBESG (léxico grego resumido) | Sim | Abbott-Smith (1922) e Middle Liddell, em domínio público |
| TBESH (léxico hebraico resumido) | **Não, sem permissão** | Definições do BDB resumido da Online Bible (© Larry Pierce); o próprio cabeçalho pede permissão antes do uso |
| Morfologia do TAHOT | **Não** | Vem do ETCBC (BHSA), que é CC BY-NC 4.0; usamos a do Open Scriptures |
| Texto grego do TAGNT | **Não** | Inclui o texto da Nestle-Aland 27/28 (Sociedade Bíblica Alemã); sub-significados e espanhol vêm do OpenGNT (CC BY-SA 4.0) |
| TTESV | **Não** | CC BY-NC (marcação da ESV) |

As glosas acabaram vindo do alinhamento direto com a BLIVRE, então as traduções em inglês do TAHOT/TAGNT não foram usadas.

### Evitar

- ETCBC BHSA: CC BY-NC 4.0 (uso comercial só com consentimento da Sociedade Bíblica Alemã).
- Nestle-Aland 27/28, ARA, ARC, NVI, NTLH, ESV: protegidas.

## Referências

- STEPBible Data: https://github.com/STEPBible/STEPBible-Data
- STEPBible, Copyrights & Licences: https://stepweb.atlassian.net/wiki/spaces/SUG/pages/12484619/Copyrights+Licences
- ETCBC BHSA: https://github.com/ETCBC/bhsa
- OpenGNT: https://github.com/eliranwong/OpenGNT
- SBLGNT: https://ebible.org/grcsbl/copyright.htm
- MorphGNT SBLGNT: https://github.com/morphgnt/sblgnt
- Berean Bible, termos: https://berean.bible/terms.htm
- Bíblia Livre: https://ebible.org/porbr2018/copyright.htm
- Bíblia Livre 2017 (CrossWire): https://github.com/scrollmapper/bible_databases
- Dodson Greek Lexicon: https://github.com/biblicalhumanities/Dodson-Greek-Lexicon
- SBLGNT (texto e aparato): https://github.com/LogosBible/SBLGNT
- eflomal: https://github.com/robertostling/eflomal

Esta análise não é parecer jurídico.
