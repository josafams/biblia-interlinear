// Roteiros dos vídeos "Como usar". Cada vídeo é uma lista de passos: a legenda que aparece na tela
// e a ação que o Playwright executa. scripts/videos/gravar.mjs grava; scripts/build_web.mjs lê só
// os títulos e as legendas para montar a seção "Como usar" da página inicial.
// `pronto: false` = a função ainda não existe; o vídeo aparece na lista como "quando a função sair".

export const grupos = [
  { id: "ler", nome: "Ler e navegar" },
  { id: "aparencia", nome: "Aparência" },
  { id: "modos", nome: "Modos de leitura" },
  { id: "anotacoes", nome: "Anotações" },
  { id: "conta", nome: "Conta" },
  { id: "estudo", nome: "Estudo" },
  { id: "instalar", nome: "Instalar e baixar" }
];

// Ações usadas pelos roteiros (t = ajudante de gravação: t.tocar, t.digitar, t.rolar, t.esperar…)
const abrirIndice = t => t.tocar("#open-toc");
const fecharPainel = t => t.tecla("Escape");
// anotações de exemplo para os vídeos que mostram a lista, o PDF e o backup
const dadosDeExemplo = async page => {
  await page.evaluate(async () => {
    const A = window.Anotacoes, id = () => crypto.randomUUID();
    const anc = (livro, cap, ver, trecho) => ({ livro, cap, ver, ver_fim: ver, camada: "versiculo", trecho });
    const et = await A.gravar("etiquetas", { id: id(), nome: "promessas" });
    await A.gravar("notas", { id: id(), cap: "GEN.1", ancora: anc("GEN", 1, 2), titulo: "Tohu e bohu", texto: "Sem forma e vazia: rima no hebraico.", etiquetas: [] });
    await A.gravar("marcacoes", { id: id(), cap: "GEN.1", ancora: anc("GEN", 1, 3, "E disse Deus: Haja luz; e houve luz."), cor: "amarelo", etiquetas: [] });
    await A.gravar("marcacoes", { id: id(), cap: "PSA.23", ancora: anc("PSA", 23, 1, "Salmo de Davi: O SENHOR é meu pastor, nada me faltará."), cor: "verde", etiquetas: [et.id] });
    await A.gravar("favoritos", { id: id(), cap: "JHN.3", ancora: anc("JHN", 3, 16), etiquetas: [] });
    await A.gravar("notas", { id: id(), cap: "ROM.8", ancora: anc("ROM", 8, 28), titulo: "", texto: "Todas as coisas contribuem para o bem.", etiquetas: [et.id] });
  });
};

export const videos = [
  {
    id: "01", n: 1, grupo: "ler", titulo: "Abrir um livro e um capítulo",
    desc: "Pelo índice, com um toque no capítulo.", inicio: "GEN.1",
    passos: [
      { legenda: "Toque em Índice, no canto de cima.", faz: abrirIndice },
      { legenda: "Escolha o livro: Êx é Êxodo.", faz: t => t.tocar('.bchip[data-cod="EXO"]') },
      { legenda: "Toque no capítulo: ele abre direto.", faz: t => t.tocar('.chchip[data-ch="20"]') },
      { legenda: "Role para ler. O topo mostra onde você está.", faz: t => t.rolar(700) }
    ]
  },
  {
    id: "02", n: 2, grupo: "ler", titulo: "Ir para qualquer versículo",
    desc: "Jo 3:16, sl 23, 1:14 ou cap 12.", inicio: "GEN.1",
    passos: [
      { legenda: "Abra o Índice.", faz: abrirIndice },
      { legenda: "Em “Ir para”, digite livro, capítulo e versículo: jo 3:16.", faz: t => t.digitar("#go-in", "jo 3:16") },
      { legenda: "Toque em Ir: o versículo abre destacado.", faz: t => t.tocar("#go-form button[type=submit]") },
      { legenda: "Funciona também com “sl 23”, “1:14” ou só o número do versículo.", faz: async t => { await abrirIndice(t); await t.digitar("#go-in", "sl 23"); await t.tocar("#go-form button[type=submit]"); } }
    ]
  },
  {
    id: "03", n: 3, grupo: "ler", titulo: "Capítulo anterior e próximo",
    desc: "E a lista de versículos do capítulo.", inicio: "RUT.1",
    passos: [
      { legenda: "No fim do capítulo, use as setas para o anterior ou o próximo.", faz: t => t.rolarAte(".chnav") },
      { legenda: "Toque em → para ir ao próximo capítulo.", faz: t => t.tocar(".chnav .next") },
      { legenda: "No Índice, a lista de versículos leva direto a cada um.", faz: async t => { await abrirIndice(t); await t.rolarPainel("#toc", 600); } },
      { legenda: "Toque num versículo para ir até ele.", faz: t => t.tocar('#toc-days .vchip[data-v="10"]') }
    ]
  },
  {
    id: "04", n: 4, grupo: "ler", titulo: "Como ler um cartão",
    desc: "Palavra, transliteração, Strong e glosa.", inicio: "GEN.1",
    passos: [
      { legenda: "Cada cartão é uma palavra do original.", faz: t => t.realcar('.word[data-v="0"][data-i="0"]') },
      { legenda: "O hebraico se lê da direita para a esquerda.", faz: t => t.realcar('#v1 .words') },
      { legenda: "Embaixo: transliteração, número Strong e glosa em português.", faz: t => t.realcar('.word[data-v="0"][data-i="1"]') },
      { legenda: "Abaixo dos cartões vem o versículo na Bíblia Livre.", faz: t => t.realcar('#v1 .blivre') }
    ]
  },
  {
    id: "05", n: 5, grupo: "ler", titulo: "Abrir um verbete",
    desc: "Origem, significado e de verbete em verbete.", inicio: "GEN.1",
    passos: [
      { legenda: "Toque numa palavra para abrir o verbete.", faz: t => t.tocar('.word[data-v="0"][data-i="0"]') },
      { legenda: "Veja origem, significado e como a Bíblia Livre traduz.", faz: t => t.rolarPainel("#detail", 300) },
      { legenda: "Toque num número Strong para ir ao verbete ligado.", faz: t => t.tocar("#detail .ref") },
      { legenda: "Use ← para voltar e ✕ para fechar.", faz: t => t.tocar("#d-back") }
    ]
  },
  {
    id: "06", n: 6, grupo: "ler", titulo: "Léxico do capítulo",
    desc: "Todas as palavras do capítulo, com busca.", inicio: "GEN.1",
    passos: [
      { legenda: "No fim do capítulo fica o léxico de todas as palavras.", faz: t => t.rolarAte("#lexico") },
      { legenda: "Busque em português, pela transliteração ou pelo número: luz.", faz: t => t.digitar("#lsearch", "luz") },
      { legenda: "Toque numa linha para abrir o verbete.", faz: t => t.tocar("#llist .lrow") }
    ]
  },
  {
    id: "07", n: 7, grupo: "ler", titulo: "Sobre o livro",
    desc: "Resumo, pessoas, linha do tempo e lugares.", inicio: "RUT.1",
    passos: [
      { legenda: "Toque em “Sobre o livro”, acima do texto.", faz: t => t.tocar("#sobre summary") },
      { legenda: "Resumo, autoria e data, pessoas principais…", faz: t => t.rolar(500) },
      { legenda: "…linha do tempo, contexto e lugares.", faz: t => t.rolar(700) }
    ]
  },
  {
    id: "08", n: 8, grupo: "ler", titulo: "Ouvir o versículo",
    desc: "Realce palavra a palavra e voz mais lenta.", inicio: "GEN.1",
    passos: [
      { legenda: "Toque em Ouvir ao lado do número do versículo.", faz: t => t.tocar('.vsay[data-verse="0"]') },
      { legenda: "Cada palavra é realçada enquanto é lida.", faz: t => t.esperar(2500) },
      { legenda: "Em Aparência › Áudio dá para falar mais devagar.", faz: async t => { await t.tocar("#open-look"); await t.rolarAte("#g-audio"); } }
    ]
  },
  {
    id: "09", n: 9, grupo: "ler", titulo: "Revisão ⚑ e ketiv/qere",
    desc: "O que a revisão automática encontrou.", inicio: "GEN.8",
    passos: [
      { legenda: "O sinal ⚑ mostra pontos da revisão automática no versículo.", faz: t => t.rolarAte("details.marks") },
      { legenda: "Toque para ver a lista.", faz: t => t.tocar("details.marks summary") },
      { legenda: "Palavras com leitura à margem (qere) mostram a forma escrita (ketiv) no verbete.", faz: t => t.tocar(".word.kt") }
    ]
  },
  {
    id: "10", n: 10, grupo: "ler", titulo: "Usar pelo teclado",
    desc: "Tab, setas, Enter e Esc.", inicio: "GEN.1", so: "computador",
    passos: [
      { legenda: "Tab passa de versículo em versículo.", faz: async t => { await t.focar('.word[data-v="0"][data-i="0"]'); } },
      { legenda: "As setas ← → andam entre as palavras no sentido da leitura.", faz: async t => { await t.tecla("ArrowLeft"); await t.tecla("ArrowLeft"); } },
      { legenda: "Enter abre o verbete.", faz: t => t.tecla("Enter") },
      { legenda: "Esc fecha.", faz: fecharPainel }
    ]
  },
  {
    id: "11", n: 11, grupo: "aparencia", titulo: "Claro, escuro e temas",
    desc: "Seis temas de cor, ou seguir o aparelho.", inicio: "PSA.23",
    passos: [
      { legenda: "O botão da lua troca para o tema escuro.", faz: t => t.tocar("#to-dark") },
      { legenda: "Em Aa há seis temas de cor.", faz: t => t.tocar("#open-look") },
      { legenda: "Escolha um tema: Papel.", faz: t => t.tocar('.tcard[data-p="papel"]') },
      { legenda: "“Automático” segue o tema do aparelho.", faz: t => t.tocar('.tcard[data-p="auto"]') }
    ]
  },
  {
    id: "12", n: 12, grupo: "aparencia", titulo: "Tamanho do texto",
    desc: "Aumentar e diminuir.", inicio: "PSA.23",
    passos: [
      { legenda: "Toque em Aa.", faz: t => t.tocar("#open-look") },
      { legenda: "Use A+ para aumentar o texto.", faz: async t => { await t.tocar("#size-up"); await t.tocar("#size-up"); } },
      { legenda: "E A− para diminuir. A escolha fica guardada.", faz: t => t.tocar("#size-down") }
    ]
  },
  {
    id: "13", n: 13, grupo: "aparencia", titulo: "Leitura fácil e cantilação",
    desc: "Fonte, espaçamento e sinais do hebraico.", inicio: "GEN.1",
    passos: [
      { legenda: "Em Aa › Leitura estão os ajustes de leitura.", faz: async t => { await t.tocar("#open-look"); await t.rolarAte("#g-read"); } },
      { legenda: "Fonte de leitura fácil no português.", faz: t => t.tocar("#t-easy") },
      { legenda: "Espaçamento amplo entre linhas e letras.", faz: t => t.tocar("#t-space") },
      { legenda: "Desligue os sinais de cantilação para ver só consoantes e vogais.", faz: t => t.tocar("#t-cant") }
    ]
  },
  {
    id: "14", n: 14, grupo: "aparencia", titulo: "Camadas dos cartões",
    desc: "Ligar e desligar o que aparece.", inicio: "GEN.1",
    passos: [
      { legenda: "Em Aa › Mostrar nos cartões, escolha o que aparece.", faz: async t => { await t.tocar("#open-look"); await t.rolarAte("#g-cards"); } },
      { legenda: "Ligue a pronúncia em português (tônica em maiúsculas).", faz: t => t.tocar("#t-pron") },
      { legenda: "Desligue o número Strong para cartões mais limpos.", faz: t => t.tocar("#t-strong") },
      { legenda: "Feche para ver o resultado.", faz: fecharPainel }
    ]
  },
  // Funções planejadas: gravadas no fim de cada fase.
  {
    id: "15", n: 15, grupo: "modos", titulo: "Trocar de modo", desc: "Bíblia, Original, Interlinear, Estudo.", inicio: "GEN.1",
    passos: [
      { legenda: "Toque em Aa: o primeiro grupo é o modo de leitura.", faz: t => t.tocar("#open-look") },
      { legenda: "Bíblia: só a Bíblia Livre, em parágrafos, como uma Bíblia comum.", faz: async t => { await t.tocar('.mcard[data-modo="biblia"]'); await t.tecla("Escape"); } },
      { legenda: "Original: só o hebraico ou o grego, corrido. A palavra abre o verbete.", faz: async t => { await t.tocar("#open-look"); await t.tocar('.mcard[data-modo="original"]'); await t.tecla("Escape"); } },
      { legenda: "Interlinear: os cartões palavra a palavra com a Bíblia Livre.", faz: async t => { await t.tocar("#open-look"); await t.tocar('.mcard[data-modo="interlinear"]'); await t.tecla("Escape"); } },
      { legenda: "O botão ⇄ no topo volta ao modo anterior.", faz: t => t.tocar("#mode-swap") }
    ]
  },
  {
    id: "16", n: 16, grupo: "modos", titulo: "Modo Personalizado", desc: "Escolher cada item da tela.", inicio: "GEN.1",
    passos: [
      { legenda: "Em Aa, escolha um modo para começar: Estudo.", faz: async t => { await t.tocar("#open-look"); await t.tocar('.mcard[data-modo="estudo"]'); } },
      { legenda: "Em “Mostrar na página”, ligue ou desligue cada item.", faz: async t => { await t.rolarAte("#g-show"); await t.tocar("#t-sobre"); } },
      { legenda: "Ao mudar qualquer item, o modo vira Personalizado.", faz: t => t.realcar('.mcard[data-modo="personalizado"]') },
      { legenda: "A escolha fica guardada para a próxima vez.", faz: t => t.tecla("Escape") }
    ]
  },
  {
    id: "17", n: 17, grupo: "modos", titulo: "Interlinear de um versículo", desc: "Lendo no modo Bíblia, com um toque.", inicio: "GEN.1",
    passos: [
      { legenda: "No modo Bíblia o texto corre em parágrafos.", faz: async t => { await t.tocar("#open-look"); await t.tocar('.mcard[data-modo="biblia"]'); await t.tecla("Escape"); } },
      { legenda: "Toque no número de um versículo.", faz: t => t.tocar("#v3 .vnum") },
      { legenda: "Aparecem os cartões do original só daquele versículo.", faz: t => t.realcar("#v3 .words") },
      { legenda: "Toque de novo no número para fechar.", faz: t => t.tocar("#v3 .vnum") }
    ]
  },
  {
    id: "18", n: 18, grupo: "anotacoes", titulo: "Marcar com cores", desc: "Versículo, trecho ou palavra do original.", inicio: "GEN.1",
    passos: [
      { legenda: "Toque em ⋯ ao lado do versículo (ou toque longo nele).", faz: t => t.tocar("#v1 .vmark") },
      { legenda: "Escolha uma das cinco cores.", faz: async t => { await t.tocar('#mbar .mb-cor[data-cor="azul"]'); await t.tocar("#mb-fechar"); } },
      { legenda: "Selecione um trecho da Bíblia Livre para marcar só ele.", faz: t => t.selecionar("#v3 .blivre", "Haja luz") },
      { legenda: "A barra aparece com o trecho: escolha a cor.", faz: async t => { await t.tocar('#mbar .mb-cor[data-cor="amarelo"]'); await t.tocar("#mb-fechar"); await t.limparSelecao(); } },
      { legenda: "Toque longo numa palavra do original marca só a palavra.", faz: async t => { await t.toqueLongo('.word[data-v="2"][data-i="3"]'); await t.tocar('#mbar .mb-cor[data-cor="rosa"]'); await t.tocar("#mb-fechar"); } }
    ]
  },
  {
    id: "19", n: 19, grupo: "anotacoes", titulo: "Escrever uma nota", desc: "Ligada ao versículo; salva sozinha.", inicio: "GEN.1",
    passos: [
      { legenda: "Toque em ⋯ no versículo e depois em Nota.", faz: async t => { await t.tocar("#v2 .vmark"); await t.tocar('#mbar [data-acao="nota"]'); } },
      { legenda: "Escreva: a nota salva sozinha enquanto você digita.", faz: t => t.digitar("#nota-texto", "Sem forma e vazia: tôhû wâbôhû rima no hebraico.") },
      { legenda: "Dá para pôr um título e etiquetas.", faz: t => t.digitar("#nota-titulo", "Tohu e bohu") },
      { legenda: "Feche: o ícone da nota aparece no versículo; toque nele para reabrir.", faz: async t => { await t.tocar("#nota [data-fechar]"); await t.realcar("#v2 .vnota"); } }
    ]
  },
  {
    id: "20", n: 20, grupo: "anotacoes", titulo: "Favoritos e etiquetas", desc: "Organizar por assunto.", inicio: "PSA.23",
    passos: [
      { legenda: "Toque em ⋯ no versículo e em Favoritar: aparece a estrela.", faz: async t => { await t.tocar("#v1 .vmark"); await t.tocar('#mbar [data-acao="fav"]'); } },
      { legenda: "Em Etiqueta, crie uma etiqueta: promessas.", faz: async t => { await t.tocar('#mbar [data-acao="etiqueta"]'); await t.digitar("#mb-et-nome", "promessas"); await t.tocar("#mb-nova-et"); } },
      { legenda: "A etiqueta fica disponível para outros versículos e notas.", faz: t => t.realcar('#mb-etiquetas .chip[aria-pressed="true"]') },
      { legenda: "Feche a barra.", faz: t => t.tocar("#mb-fechar") }
    ]
  },
  {
    id: "21", n: 21, grupo: "anotacoes", titulo: "Minhas anotações", desc: "Buscar e filtrar tudo.", inicio: "GEN.1",
    preparar: dadosDeExemplo,
    passos: [
      { legenda: "No Índice, toque em Minhas anotações.", faz: async t => { await t.tocar("#open-toc"); await t.rolarAte("#open-minhas"); await t.tocar("#open-minhas"); } },
      { legenda: "Tudo o que você marcou e anotou, na ordem da Bíblia.", faz: t => t.esperar(800) },
      { legenda: "Busque por uma palavra: pastor.", faz: t => t.digitar("#mn-busca", "pastor") },
      { legenda: "Ou filtre por tipo e por etiqueta.", faz: async t => { await t.digitar("#mn-busca", ""); await t.tocar('.mn-filtros .chip[data-tipo="notas"]'); } },
      { legenda: "Toque num item para ir ao versículo ou abrir a nota.", faz: t => t.tocar('.mn-item[data-tipo="notas"]') }
    ]
  },
  {
    id: "22", n: 22, grupo: "anotacoes", titulo: "Exportar em PDF", desc: "O caderno de estudo, pronto para salvar.", inicio: "GEN.1",
    preparar: dadosDeExemplo,
    passos: [
      { legenda: "Em Minhas anotações, toque em Exportar PDF.", faz: async t => { await t.page.evaluate(() => { window.__semImprimir = true; }); await t.tocar("#open-toc"); await t.rolarAte("#open-minhas"); await t.tocar("#open-minhas"); await t.tocar("#mn-exportar"); } },
      { legenda: "Escolha o que entra: notas, marcações, o texto, o interlinear.", faz: async t => { await t.realcar("#exportar fieldset:nth-of-type(2)"); await t.tocar("#exp-inter"); } },
      { legenda: "Toque em Gerar PDF.", faz: t => t.tocar("#exp-gerar") },
      { legenda: "O caderno sai agrupado por versículo, com as cores, notas e etiquetas. Salve como PDF ou imprima.", faz: async t => {
        await t.page.evaluate(() => {
          const f = document.createElement("iframe"); f.id = "__previa";
          f.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483646;background:#fff";
          f.srcdoc = window.__ultimoCaderno.html; document.body.appendChild(f);
        });
        await t.esperar(1500);
        await t.page.evaluate(() => document.getElementById("__previa").contentWindow.scrollBy({ top: 500, behavior: "smooth" }));
        await t.esperar(1800);
      } }
    ]
  },
  {
    id: "23", n: 23, grupo: "anotacoes", titulo: "Baixar e importar meus dados", desc: "Backup em arquivo.", inicio: "GEN.1",
    preparar: dadosDeExemplo,
    passos: [
      { legenda: "Em Minhas anotações, toque em Baixar meus dados.", faz: async t => { await t.tocar("#open-toc"); await t.rolarAte("#open-minhas"); await t.tocar("#open-minhas"); await t.tocar("#mn-baixar"); } },
      { legenda: "Um arquivo com tudo o que você anotou fica salvo no aparelho.", faz: t => t.esperar(1500) },
      { legenda: "Em outro aparelho, toque em Importar e escolha esse arquivo.", faz: async t => {
        const json = await t.page.evaluate(() => JSON.stringify(window.__ultimoBackup));
        await t.page.evaluate(async () => { const d = new Dexie("biblia-interlinear"); await d.open(); for (const tb of d.tables) await tb.clear(); d.close(); await window.Anotacoes.abrirLista(); });  // simula o aparelho novo
        await t.esperar(600);
        await t.realcar("#mn-importar");
        await t.page.setInputFiles("#mn-arquivo", { name: "biblia-anotacoes.json", mimeType: "application/json", buffer: Buffer.from(json) });
      } },
      { legenda: "As anotações voltam. O que já existia não é duplicado.", faz: t => t.esperar(1800) }
    ]
  },
  { id: "24", n: 24, grupo: "conta", titulo: "Entrar com Google", desc: "E enviar o que já foi anotado.", pronto: false, passos: [] },
  { id: "25", n: 25, grupo: "conta", titulo: "Dois aparelhos", desc: "A nota feita no celular aparece no computador.", pronto: false, passos: [] },
  { id: "26", n: 26, grupo: "conta", titulo: "Sair e apagar da nuvem", desc: "Seus dados, sob seu controle.", pronto: false, passos: [] },
  { id: "27", n: 27, grupo: "estudo", titulo: "Perguntas ao texto", desc: "Ligar, responder e ver o progresso.", pronto: false, passos: [] },
  { id: "31", n: 31, grupo: "estudo", titulo: "Meu progresso", desc: "Capítulos lidos, tempo e plano de leitura.", pronto: false, passos: [] },
  // Gravados à mão (telas do sistema): sequências de imagens com legenda em videos/manuais/.
  {
    id: "28", n: 28, grupo: "instalar", titulo: "Instalar na tela inicial", desc: "Android e iPhone, sem loja.", manual: true,
    passos: [
      { legenda: "Android (Chrome): abra o site, toque no menu ⋮ e em “Instalar app” ou “Adicionar à tela inicial”." },
      { legenda: "iPhone (Safari): toque em Compartilhar e em “Adicionar à Tela de Início”." },
      { legenda: "Pronto: o ícone abre a Bíblia em tela cheia, mesmo sem internet." }
    ]
  },
  {
    id: "29", n: 29, grupo: "instalar", titulo: "Instalar o APK", desc: "O app com a Bíblia inteira dentro.", manual: true,
    passos: [
      { legenda: "No celular Android, abra a página Releases › app-android do repositório." },
      { legenda: "Toque no arquivo .apk para baixar." },
      { legenda: "Abra o arquivo baixado e permita instalar apps desta fonte quando o Android pedir." },
      { legenda: "Toque em Instalar e depois em Abrir." }
    ]
  },
  {
    id: "30", n: 30, grupo: "instalar", titulo: "EPUB no Kindle", desc: "Pelo Send to Kindle.", manual: true,
    passos: [
      { legenda: "Baixe o EPUB na seção Baixar desta página (AT, NT ou um livro, se for mandar por e-mail)." },
      { legenda: "Abra o site ou app Send to Kindle da Amazon e envie o arquivo." },
      { legenda: "O livro aparece na biblioteca do Kindle; toque numa palavra do original para ver a nota." }
    ]
  }
];

// Só o que a página inicial precisa (sem as funções de ação).
export function resumo() {
  return {
    grupos,
    videos: videos.map(v => ({ id: v.id, n: v.n, grupo: v.grupo, titulo: v.titulo, desc: v.desc, pronto: v.pronto !== false, passos: v.passos.map(p => p.legenda) }))
  };
}
