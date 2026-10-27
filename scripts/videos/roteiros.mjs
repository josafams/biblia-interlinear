// Roteiros dos vídeos "Como usar". Cada vídeo é uma lista de passos: a legenda que aparece na tela
// e a ação que o Playwright executa. scripts/videos/gravar.mjs grava; vite/site/home-page.ts lê só
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
// no celular as setas e o Ouvir ficam na barra de baixo; no computador, na barra de cima
const naBarra = (t, celular, computador) => t.tocar(t.page.viewportSize().width <= 720 ? celular : computador);
// Índice › Você (conta, Meu progresso, planos) e Índice › Notas (Minhas anotações)
const abrirVoce = async t => {
  await t.tocar("#open-toc");
  await t.tocar('#toc .toc-tabs a[href="#toc-voce"]');
};
const abrirMinhas = async t => {
  await t.tocar("#open-toc");
  await t.tocar('#toc .toc-tabs a[href="#toc-notas"]');
};
const fecharPainel = t => t.onKey("Escape");
// no celular a folha Anotar abre compacta: "Nota" e "Mais" mostram a nota e as etiquetas (no computador já estão lá)
const abrirNota = async t => {
  if (await t.page.locator('#mbar [data-action="escrever"]').isVisible()) await t.tocar('#mbar [data-action="escrever"]');
};
const abrirMais = async t => {
  const b = t.page.locator('#mbar [data-action="mais"]');
  if ((await b.isVisible()) && (await b.getAttribute("aria-expanded")) !== "true") await t.tocar('#mbar [data-action="mais"]');
};
// anotações de exemplo para os vídeos que mostram a lista, o PDF e o backup
const dadosDeExemplo = async page => {
  await page.evaluate(async () => {
    const A = window.Annotations,
      id = () => crypto.randomUUID();
    const anc = (livro, cap, ver, trecho) => ({ livro, cap, ver, ver_fim: ver, camada: "versiculo", trecho });
    const tag = await A.save("etiquetas", { id: id(), nome: "promessas" });
    await A.save("notas", {
      id: id(),
      cap: "GEN.1",
      ancora: anc("GEN", 1, 2),
      titulo: "Tohu e bohu",
      texto: "Sem forma e vazia: rima no hebraico.",
      etiquetas: []
    });
    await A.save("marcacoes", {
      id: id(),
      cap: "GEN.1",
      ancora: anc("GEN", 1, 3, "E disse Deus: Haja luz; e houve luz."),
      cor: "amarelo",
      etiquetas: []
    });
    await A.save("marcacoes", {
      id: id(),
      cap: "PSA.23",
      ancora: anc("PSA", 23, 1, "Salmo de Davi: O SENHOR é meu pastor, nada me faltará."),
      cor: "verde",
      etiquetas: [tag.id]
    });
    await A.save("favoritos", { id: id(), cap: "JHN.3", ancora: anc("JHN", 3, 16), etiquetas: [] });
    await A.save("notas", {
      id: id(),
      cap: "ROM.8",
      ancora: anc("ROM", 8, 28),
      titulo: "",
      texto: "Todas as coisas contribuem para o bem.",
      etiquetas: [tag.id]
    });
  });
};

// conta já ligada antes do corte do vídeo (para os vídeos que começam conectados)
async function entrarNaConta(t) {
  const p = t.page;
  await p.waitForFunction(() => window.Account && window.Sync);
  await p.click("#open-toc");
  await p.click('#toc .toc-tabs a[href="#toc-voce"]');
  await p.click("#account-signin");
  await p.locator("#account-sync", { hasText: "Sincronizado" }).waitFor();
  await p.keyboard.press("Escape");
  await p.evaluate(() => window.scrollTo(0, 0));
}
// leituras e tempo de exemplo para o vídeo do progresso (40 dias, Gênesis, alguns livros curtos, Mateus 1–10)
async function progressoDeExemplo(page) {
  await page.waitForFunction(() => window.Progress && window.__books);
  await page.evaluate(async () => {
    const A = window.Annotations,
      ap = A.storage.aparelho,
      d0 = new Date(),
      currentTime = new Date().toISOString();
    const dia = n => {
      const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    for (let n = 0; n < 40; n++)
      if (n % 6 !== 5)
        await A.save("tempo", {
          id: `${ap}:${dia(n)}`,
          aparelho: ap,
          dia: dia(n),
          segundos: 300 + ((n * 137) % 1500),
          livros: { GEN: 400, MAT: 200 },
          caps: 2,
          verbetes: 3
        });
    const lido = async (cod, n) =>
      A.save("leituras", { id: `${cod}.${n}`, livro: cod, n, lido: true, primeira: currentTime, ultima: currentTime, vezes: 1 });
    for (let c = 1; c <= 50; c++) await lido("GEN", c);
    for (const l of ["RUT", "JON", "PHM", "JUD", "OBA"]) for (let c = 1; c <= window.__books[l].chapterCount; c++) await lido(l, c);
    for (let c = 1; c <= 10; c++) await lido("MAT", c);
    await A.save("preferencias", { id: "posicao", cod: "MAT", cap: 11, quando: currentTime });
  });
}
// simula o computador gravando uma nota na nuvem (um lote de outro aparelho)
function notaDeOutroAparelho(t) {
  const currentTime = new Date().toISOString();
  const nota = {
    id: "nota-do-computador",
    cap: "GEN.1",
    ancora: { livro: "GEN", cap: 1, ver: 1, ver_fim: 1, camada: "versiculo" },
    titulo: "No princípio",
    texto: "Bereshit: “no princípio”. A Bíblia começa com Deus, não com explicações.",
    etiquetas: [],
    criado_em: currentTime,
    alterado_em: currentTime,
    base: null,
    apagado: false,
    relogio: `${String(Date.now()).padStart(14, "0")}-0000-computad`
  };
  t.nuvem.criar(
    `lote-computad-${Date.now()}.json`,
    JSON.stringify({
      formato: "biblia-interlinear-lote",
      versao: 1,
      aparelho: "computad",
      criado_em: currentTime,
      colecoes: { notas: [nota] }
    })
  );
  return t.esperar(400);
}

export const videos = [
  {
    id: "01",
    n: 1,
    grupo: "ler",
    titulo: "Abrir um livro e um capítulo",
    desc: "Por Livros, com um toque no capítulo.",
    inicio: "GEN.1",
    steps: [
      { legenda: "Toque em Livros (na barra de baixo no celular, na de cima no computador).", faz: abrirIndice },
      { legenda: "Escolha o livro: Êxodo. Ao lado do nome, quantos capítulos ele tem.", faz: t => t.tocar('.bchip[data-cod="EXO"]') },
      { legenda: "Toque no capítulo: ele abre direto.", faz: t => t.tocar('.chchip[data-ch="20"]') },
      { legenda: "Role para ler. O topo mostra onde você está, e a linha fina, quanto já leu.", faz: t => t.doScroll(700) }
    ]
  },
  {
    id: "02",
    n: 2,
    grupo: "ler",
    titulo: "Ir para qualquer versículo",
    desc: "Jo 3:16, sl 23, 1:14 ou cap 12.",
    inicio: "GEN.1",
    steps: [
      { legenda: "Toque em Livros.", faz: abrirIndice },
      { legenda: "Na busca de Livros, digite livro, capítulo e versículo: jo 3:16.", faz: t => t.digitar("#go-in", "jo 3:16") },
      { legenda: "Toque em Ir: o versículo abre destacado.", faz: t => t.tocar("#go-form button[type=submit]") },
      {
        legenda: "Funciona também com “sl 23”, “1:14” ou só o número do versículo.",
        faz: async t => {
          await abrirIndice(t);
          await t.digitar("#go-in", "sl 23");
          await t.tocar("#go-form button[type=submit]");
        }
      }
    ]
  },
  {
    id: "03",
    n: 3,
    grupo: "ler",
    titulo: "Capítulo anterior e próximo",
    desc: "Pela barra, pelo fim do capítulo e pelo título.",
    inicio: "RUT.1",
    steps: [
      { legenda: "As setas da barra levam ao capítulo anterior ou ao próximo.", faz: t => naBarra(t, "#bb-next", "#bar-next") },
      { legenda: "No fim do capítulo, o cartão leva ao próximo.", faz: t => t.rolarAte(".chnav") },
      {
        legenda: "Tocar no título, lá em cima, abre os capítulos do livro.",
        faz: t => t.tocar("#where")
      },
      { legenda: "Toque num capítulo para ir até ele.", faz: t => t.tocar('#chgrid .chchip[data-ch="2"]') }
    ]
  },
  {
    id: "04",
    n: 4,
    grupo: "ler",
    titulo: "Como ler um cartão",
    desc: "Palavra, transliteração, Strong e glosa.",
    inicio: "GEN.1",
    steps: [
      { legenda: "Cada cartão é uma palavra do original.", faz: t => t.realcar('.word[data-v="0"][data-i="0"]') },
      { legenda: "O hebraico se lê da direita para a esquerda.", faz: t => t.realcar("#v1 .words") },
      { legenda: "Embaixo: transliteração, número Strong e glosa em português.", faz: t => t.realcar('.word[data-v="0"][data-i="1"]') },
      { legenda: "Abaixo dos cartões vem o versículo na Bíblia Livre.", faz: t => t.realcar("#v1 .blivre") }
    ]
  },
  {
    id: "05",
    n: 5,
    grupo: "ler",
    titulo: "Abrir um verbete",
    desc: "Origem, significado e de verbete em verbete.",
    inicio: "GEN.1",
    steps: [
      { legenda: "Toque numa palavra para abrir o verbete.", faz: t => t.tocar('.word[data-v="0"][data-i="0"]') },
      { legenda: "Veja significado, como a Bíblia Livre traduz e a origem.", faz: t => t.rolarPainel("#detail", 300) },
      { legenda: "Toque num número Strong para ir ao verbete ligado.", faz: t => t.tocar("#detail .ref") },
      { legenda: "Use ← para voltar ao verbete anterior.", faz: t => t.tocar("#d-back") },
      { legenda: "As setas ‹ › passam para a palavra seguinte, sem fechar. ✕ fecha.", faz: t => t.tocar("#d-next") }
    ]
  },
  {
    id: "06",
    n: 6,
    grupo: "ler",
    titulo: "Léxico do capítulo",
    desc: "Todas as palavras do capítulo, com busca.",
    inicio: "GEN.1",
    steps: [
      { legenda: "No fim do capítulo fica o léxico de todas as palavras.", faz: t => t.rolarAte("#lexico") },
      { legenda: "Busque em português, pela transliteração ou pelo número: luz.", faz: t => t.digitar("#lsearch", "luz") },
      { legenda: "Toque numa linha para abrir o verbete.", faz: t => t.tocar("#llist .lrow") }
    ]
  },
  {
    id: "07",
    n: 7,
    grupo: "ler",
    titulo: "Sobre o livro",
    desc: "Resumo, pessoas, linha do tempo e lugares.",
    inicio: "RUT.1",
    steps: [
      { legenda: "Toque em “Sobre” e o nome do livro, acima do texto.", faz: t => t.tocar("#chip-about") },
      { legenda: "Resumo, autoria e data, pessoas principais…", faz: t => t.doScroll(500) },
      { legenda: "…linha do tempo, contexto e lugares.", faz: t => t.doScroll(700) }
    ]
  },
  {
    id: "08",
    n: 8,
    grupo: "ler",
    titulo: "Ouvir o capítulo",
    desc: "Realce palavra a palavra e voz mais lenta.",
    inicio: "GEN.1",
    steps: [
      { legenda: "Toque em Ouvir: a leitura começa no versículo que está na tela.", faz: t => naBarra(t, "#bb-say", "#bar-say") },
      { legenda: "Cada palavra é realçada enquanto é lida. Toque de novo para parar.", faz: t => t.esperar(2500) },
      {
        legenda: "Para ouvir um versículo só, toque em ⋯ ao lado dele e em Ouvir.",
        faz: async t => {
          await naBarra(t, "#bb-say", "#bar-say");
          await t.tocar("#v3 .vmark");
          await t.tocar('#mbar [data-action="ouvir"]');
          await t.esperar(1200);
          await t.tocar("#mb-close");
        }
      },
      {
        legenda: "Em Aparência › Áudio dá para falar mais devagar.",
        faz: async t => {
          await t.tocar("#open-look");
          await t.rolarAte("#g-audio");
        }
      }
    ]
  },
  {
    id: "09",
    n: 9,
    grupo: "ler",
    titulo: "Revisão ⚑ e ketiv/qere",
    desc: "O que a revisão automática encontrou.",
    inicio: "GEN.8",
    steps: [
      { legenda: "O ponto no número mostra que a revisão automática encontrou algo no versículo.", faz: t => t.rolarAte(".vnum.has-rev") },
      { legenda: "Toque no ⋯ para ler a explicação.", faz: t => t.tocar(".verse:has(.vnum.has-rev) .vmark") },
      {
        legenda: "Palavras com leitura à margem (qere) mostram a forma escrita (ketiv) no verbete.",
        faz: async t => {
          await fecharPainel(t);
          await t.tocar(".word.kt");
        }
      }
    ]
  },
  {
    id: "10",
    n: 10,
    grupo: "ler",
    titulo: "Usar pelo teclado",
    desc: "Tab, setas, Enter e Esc.",
    inicio: "GEN.1",
    os: "desktop",
    steps: [
      {
        legenda: "Tab passa de versículo em versículo.",
        faz: async t => {
          await t.focar('.word[data-v="0"][data-i="0"]');
        }
      },
      {
        legenda: "As setas ← → andam entre as palavras no sentido da leitura.",
        faz: async t => {
          await t.onKey("ArrowLeft");
          await t.onKey("ArrowLeft");
        }
      },
      { legenda: "Enter abre o verbete.", faz: t => t.onKey("Enter") },
      { legenda: "Esc fecha.", faz: fecharPainel },
      { legenda: "[ e ] mudam de capítulo.", faz: t => t.onKey("]") },
      {
        legenda: "/ abre a busca.",
        faz: async t => {
          await t.onKey("/");
          await t.esperar(400);
          await fecharPainel(t);
        }
      }
    ]
  },
  {
    id: "11",
    n: 11,
    grupo: "aparencia",
    titulo: "Claro, escuro e temas",
    desc: "Seis temas de cor, ou seguir o aparelho.",
    inicio: "PSA.23",
    steps: [
      { legenda: "Em Aa há seis temas de cor.", faz: t => t.tocar("#open-look") },
      { legenda: "Escuro para ler à noite.", faz: t => t.tocar('.tcard[data-p="escuro"]') },
      { legenda: "Escolha um tema: Papel.", faz: t => t.tocar('.tcard[data-p="papel"]') },
      { legenda: "“Automático” segue o tema do aparelho.", faz: t => t.tocar('.tcard[data-p="auto"]') }
    ]
  },
  {
    id: "12",
    n: 12,
    grupo: "aparencia",
    titulo: "Tamanho do texto",
    desc: "Aumentar e diminuir.",
    inicio: "PSA.23",
    steps: [
      { legenda: "Toque em Aa.", faz: t => t.tocar("#open-look") },
      {
        legenda: "Use A+ para aumentar o texto.",
        faz: async t => {
          await t.tocar("#size-up");
          await t.tocar("#size-up");
        }
      },
      { legenda: "E A− para diminuir. A escolha fica guardada.", faz: t => t.tocar("#size-down") }
    ]
  },
  {
    id: "13",
    n: 13,
    grupo: "aparencia",
    titulo: "Leitura fácil e cantilação",
    desc: "Fonte, espaçamento e sinais do hebraico.",
    inicio: "GEN.1",
    steps: [
      {
        legenda: "Em Aa › Texto estão os ajustes de leitura.",
        faz: async t => {
          await t.tocar("#open-look");
          await t.rolarAte("#t-easy");
        }
      },
      { legenda: "Fonte de leitura fácil no português.", faz: t => t.tocar("#t-easy") },
      { legenda: "Espaçamento amplo entre linhas e letras.", faz: t => t.tocar("#t-space") },
      { legenda: "Desligue os sinais de cantilação para ver só consoantes e vogais.", faz: t => t.tocar("#t-cant") }
    ]
  },
  {
    id: "14",
    n: 14,
    grupo: "aparencia",
    titulo: "Camadas dos cartões",
    desc: "Ligar e desligar o que aparece.",
    inicio: "GEN.1",
    steps: [
      {
        legenda: "Em Aa › O que mostrar, escolha o que aparece.",
        faz: async t => {
          await t.tocar("#open-look");
          await t.rolarAte("#g-show");
        }
      },
      { legenda: "Ligue a pronúncia em português (tônica em maiúsculas).", faz: t => t.tocar("#t-pron") },
      { legenda: "Ligue o número Strong para estudar com o dicionário.", faz: t => t.tocar("#t-strong") },
      { legenda: "Feche para ver o resultado.", faz: fecharPainel }
    ]
  },
  // Funções planejadas: gravadas no fim de cada fase.
  {
    id: "15",
    n: 15,
    grupo: "modos",
    titulo: "Trocar de modo",
    desc: "Bíblia, Original, Interlinear, Estudo.",
    inicio: "GEN.1",
    steps: [
      { legenda: "Toque em Aa: o primeiro grupo é o modo de leitura.", faz: t => t.tocar("#open-look") },
      {
        legenda: "Bíblia: só a Bíblia Livre, em parágrafos, como uma Bíblia comum.",
        faz: async t => {
          await t.tocar('.mcard[data-modo="biblia"]');
          await t.onKey("Escape");
        }
      },
      {
        legenda: "Original: só o hebraico ou o grego, corrido. A palavra abre o verbete.",
        faz: async t => {
          await t.tocar("#open-look");
          await t.tocar('.mcard[data-modo="original"]');
          await t.onKey("Escape");
        }
      },
      {
        legenda: "Interlinear: os cartões palavra a palavra com a Bíblia Livre.",
        faz: async t => {
          await t.tocar("#open-look");
          await t.tocar('.mcard[data-modo="interlinear"]');
          await t.onKey("Escape");
        }
      },
      {
        legenda: "Estudo: tudo do Interlinear mais Strong, pronúncia e gramática.",
        faz: async t => {
          await t.tocar("#open-look");
          await t.tocar('.mcard[data-modo="estudo"]');
          await t.onKey("Escape");
        }
      }
    ]
  },
  {
    id: "16",
    n: 16,
    grupo: "modos",
    titulo: "Modo Personalizado",
    desc: "Escolher cada item da tela.",
    inicio: "GEN.1",
    steps: [
      {
        legenda: "Em Aa, escolha um modo para começar: Estudo.",
        faz: async t => {
          await t.tocar("#open-look");
          await t.tocar('.mcard[data-modo="estudo"]');
        }
      },
      {
        legenda: "Em “O que mostrar”, ligue ou desligue cada item.",
        faz: async t => {
          await t.rolarAte("#g-show");
          await t.tocar("#t-about");
        }
      },
      { legenda: "Ao mudar qualquer item, o modo vira Personalizado.", faz: t => t.realcar("#mode-note") },
      { legenda: "A escolha fica guardada para a próxima vez.", faz: t => t.onKey("Escape") }
    ]
  },
  {
    id: "17",
    n: 17,
    grupo: "modos",
    titulo: "Interlinear de um versículo",
    desc: "Lendo no modo Bíblia, com um toque.",
    inicio: "GEN.1",
    steps: [
      {
        legenda: "No modo Bíblia o texto corre em parágrafos.",
        faz: async t => {
          await t.tocar("#open-look");
          await t.tocar('.mcard[data-modo="biblia"]');
          await t.onKey("Escape");
        }
      },
      { legenda: "Toque no número de um versículo.", faz: t => t.tocar("#v3 .vnum") },
      { legenda: "Aparecem os cartões do original só daquele versículo.", faz: t => t.realcar("#v3 .words") },
      { legenda: "Toque de novo no número para fechar.", faz: t => t.tocar("#v3 .vnum") }
    ]
  },
  {
    id: "18",
    n: 18,
    grupo: "anotacoes",
    titulo: "Marcar com cores",
    desc: "Versículo, trecho ou palavra do original.",
    inicio: "GEN.1",
    steps: [
      { legenda: "Toque em ⋯ ao lado do versículo (ou toque longo nele).", faz: t => t.tocar("#v1 .vmark") },
      {
        legenda: "Escolha uma das cinco cores.",
        faz: async t => {
          await t.tocar('#mbar .mb-color[data-cor="azul"]');
          await t.tocar("#mb-close");
        }
      },
      { legenda: "Selecione um trecho da Bíblia Livre para marcar só ele.", faz: t => t.selecionar("#v3 .blivre", "Haja luz") },
      {
        legenda: "A barra aparece com o trecho: escolha a cor.",
        faz: async t => {
          await t.tocar('#mbar .mb-color[data-cor="amarelo"]');
          await t.tocar("#mb-close");
          await t.limparSelecao();
        }
      },
      {
        legenda: "Toque longo numa palavra do original marca só a palavra.",
        faz: async t => {
          await t.toqueLongo('.word[data-v="2"][data-i="3"]');
          await t.tocar('#mbar .mb-color[data-cor="rosa"]');
          await t.tocar("#mb-close");
        }
      }
    ]
  },
  {
    id: "19",
    n: 19,
    grupo: "anotacoes",
    titulo: "Escrever uma nota",
    desc: "Ligada ao versículo; salva sozinha.",
    inicio: "GEN.1",
    steps: [
      {
        legenda: "Toque em ⋯ no versículo e em Nota.",
        faz: async t => {
          await t.tocar("#v2 .vmark");
          await abrirNota(t);
        }
      },
      {
        legenda: "Escreva na nota: ela salva sozinha enquanto você digita.",
        faz: t => t.digitar("#mb-note", "Sem forma e vazia: tôhû wâbôhû rima no hebraico.")
      },
      {
        legenda: "Feche: o começo da nota aparece embaixo do versículo.",
        faz: async t => {
          await t.tocar("#mb-close");
          await t.realcar("#v2 .vann");
        }
      },
      {
        legenda: "Toque nela para abrir em tela cheia e pôr um título.",
        faz: async t => {
          await t.tocar("#v2 .vann-note");
          await t.digitar("#note-title", "Tohu e bohu");
        }
      }
    ]
  },
  {
    id: "20",
    n: 20,
    grupo: "anotacoes",
    titulo: "Favoritos e etiquetas",
    desc: "Organizar por assunto.",
    inicio: "PSA.23",
    steps: [
      {
        legenda: "Toque em ⋯ no versículo e em Favoritar: aparece a estrela.",
        faz: async t => {
          await t.tocar("#v1 .vmark");
          await t.tocar('#mbar [data-action="fav"]');
        }
      },
      {
        legenda: "Em Mais, nas etiquetas, crie uma nova: promessas.",
        faz: async t => {
          await abrirMais(t);
          await t.digitar("#mb-tag-name", "promessas");
          await t.tocar("#mb-new-tag");
        }
      },
      {
        legenda: "A etiqueta fica disponível para outros versículos e notas.",
        faz: t => t.realcar('#mb-tags .chip[aria-pressed="true"]')
      },
      {
        legenda: "Feche: as etiquetas aparecem embaixo do versículo.",
        faz: async t => {
          await t.tocar("#mb-close");
          await t.realcar("#v1 .vann");
        }
      }
    ]
  },
  {
    id: "21",
    n: 21,
    grupo: "anotacoes",
    titulo: "Minhas anotações",
    desc: "Buscar e filtrar tudo.",
    inicio: "GEN.1",
    prepare: dadosDeExemplo,
    steps: [
      { legenda: "Em Livros, toque na aba Notas.", faz: abrirMinhas },
      { legenda: "Tudo o que você marcou e anotou, versículo por versículo, na ordem da Bíblia.", faz: t => t.esperar(800) },
      { legenda: "Busque por uma palavra: pastor.", faz: t => t.digitar("#mn-search", "pastor") },
      {
        legenda: "Ou filtre por tipo e por etiqueta.",
        faz: async t => {
          await t.digitar("#mn-search", "");
          await t.tocar('#mn-tags .chip:has-text("promessas")');
          await t.tocar('#mn-tags .chip:has-text("promessas")');
          await t.tocar('.mn-filters .chip[data-tipo="notas"]');
        }
      },
      { legenda: "Toque num item para ir ao versículo ou abrir a nota.", faz: t => t.tocar('.mn-item[data-tipo="notas"]') }
    ]
  },
  {
    id: "22",
    n: 22,
    grupo: "anotacoes",
    titulo: "Exportar em PDF",
    desc: "O caderno de estudo, pronto para salvar.",
    inicio: "GEN.1",
    prepare: dadosDeExemplo,
    steps: [
      {
        legenda: "Em Notas, no menu ⋯, toque em Exportar PDF.",
        faz: async t => {
          await t.page.evaluate(() => {
            window.__noPrint = true;
          });
          await abrirMinhas(t);
          await t.tocar("#mn-more summary");
          await t.tocar("#mn-export");
        }
      },
      {
        legenda: "Escolha o que entra: notas, marcações, o texto, o interlinear.",
        faz: async t => {
          await t.realcar("#exportar fieldset:nth-of-type(2)");
          await t.tocar("#exp-inter");
        }
      },
      { legenda: "Toque em Gerar PDF.", faz: t => t.tocar("#exp-generate") },
      {
        legenda: "O caderno sai agrupado por versículo, com as cores, notas e etiquetas. Salve como PDF ou imprima.",
        faz: async t => {
          await t.page.evaluate(() => {
            const f = document.createElement("iframe");
            f.id = "__previa";
            f.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483646;background:#fff";
            f.srcdoc = window.__ultimoCaderno.html;
            document.body.appendChild(f);
          });
          await t.esperar(1500);
          await t.page.evaluate(() => document.getElementById("__previa").contentWindow.scrollBy({ top: 500, behavior: "smooth" }));
          await t.esperar(1800);
        }
      }
    ]
  },
  {
    id: "23",
    n: 23,
    grupo: "anotacoes",
    titulo: "Baixar e importar meus dados",
    desc: "Backup em arquivo.",
    inicio: "GEN.1",
    prepare: dadosDeExemplo,
    steps: [
      {
        legenda: "Em Notas, no menu ⋯, toque em Baixar meus dados.",
        faz: async t => {
          await abrirMinhas(t);
          await t.tocar("#mn-more summary");
          await t.tocar("#mn-download");
        }
      },
      { legenda: "Um arquivo com tudo o que você anotou fica salvo no aparelho.", faz: t => t.esperar(1500) },
      {
        legenda: "Em outro aparelho, toque em Importar e escolha esse arquivo.",
        faz: async t => {
          const json = await t.page.evaluate(() => JSON.stringify(window.__ultimoBackup));
          await t.page.evaluate(async () => {
            const d = new Dexie("biblia-interlinear");
            await d.open();
            for (const tb of d.tables) await tb.clear();
            d.close();
            await window.Annotations.openList();
          }); // simula o aparelho novo
          await t.esperar(600);
          await t.tocar("#mn-more summary");
          await t.realcar("#mn-import");
          await t.page.setInputFiles("#mn-file", {
            name: "biblia-annotations.json",
            mimeType: "application/json",
            buffer: Buffer.from(json)
          });
        }
      },
      { legenda: "As anotações voltam. O que já existia não é duplicado.", faz: t => t.esperar(1800) }
    ]
  },
  {
    id: "24",
    n: 24,
    grupo: "conta",
    titulo: "Entrar com Google",
    desc: "E enviar o que já foi anotado.",
    inicio: "GEN.1",
    google: true,
    prepare: dadosDeExemplo,
    steps: [
      {
        legenda: "Em Livros, na aba Você, toque em Entrar com Google.",
        faz: async t => {
          await abrirVoce(t);
          await t.realcar("#conta");
          await t.tocar("#account-signin");
        }
      },
      {
        legenda: "Escolha sua conta e permita: o app só acessa uma pasta própria e privada no seu Google Drive.",
        faz: t => t.page.locator("#account-sync").waitFor()
      },
      {
        legenda: "O que você já tinha anotado neste aparelho é enviado sozinho para a conta.",
        faz: async t => {
          await t.page.locator("#account-sync", { hasText: "Sincronizado" }).waitFor();
          await t.realcar("#account-sync");
        }
      },
      { legenda: "Daqui em diante, tudo sincroniza sozinho entre seus aparelhos.", faz: t => t.esperar(800) }
    ]
  },
  {
    id: "25",
    n: 25,
    grupo: "conta",
    titulo: "Dois aparelhos",
    desc: "A nota feita no computador aparece no celular.",
    inicio: "GEN.1",
    google: true,
    before: entrarNaConta,
    steps: [
      { legenda: "Com a mesma conta no celular e no computador, as anotações valem nos dois.", faz: t => t.esperar(600) },
      { legenda: "Uma nota escrita no outro aparelho…", faz: t => notaDeOutroAparelho(t) },
      {
        legenda: "…chega aqui sozinha em poucos segundos, com o app aberto.",
        faz: async t => {
          await t.page.evaluate(() => window.Sync.currentTime());
          await t.page.locator("#v1 .vann-note").waitFor();
          await t.realcar("#v1 .vann-note");
        }
      },
      { legenda: "Toque na nota sob o versículo para lê-la.", faz: t => t.tocar("#v1 .vann-note") }
    ]
  },
  {
    id: "26",
    n: 26,
    grupo: "conta",
    titulo: "Sair e apagar da nuvem",
    desc: "Seus dados, sob seu controle.",
    inicio: "GEN.1",
    google: true,
    prepare: dadosDeExemplo,
    before: entrarNaConta,
    steps: [
      {
        legenda: "Sua conta fica em Livros, na aba Você.",
        faz: async t => {
          await abrirVoce(t);
          await t.realcar("#conta");
        }
      },
      {
        legenda: "Em Sair, você escolhe manter uma cópia das anotações aqui ou apagar deste aparelho.",
        faz: async t => {
          await t.tocar("#account-signout");
          await t.realcar(".account-box");
          await t.tocar('.account-box button[data-r=""]');
        }
      },
      {
        legenda: "Para apagar tudo do seu Google Drive, toque em Apagar meus dados do Google Drive.",
        faz: t => t.tocar("#account-wipe-cloud")
      },
      {
        legenda: "Confirme. As anotações continuam neste aparelho e você sai da conta.",
        faz: async t => {
          await t.tocar('.account-box button[data-r="sim"]');
          await t.page.locator("#account-signin").waitFor();
        }
      }
    ]
  },
  {
    id: "27",
    n: 27,
    grupo: "estudo",
    titulo: "Perguntas ao texto",
    desc: "Pensar no capítulo e anotar a resposta.",
    inicio: "RUT.1",
    steps: [
      {
        legenda: "No fim do capítulo ficam as Perguntas ao texto: de 3 a 5, sem respostas, para pensar sozinho ou em grupo.",
        faz: async t => {
          await t.rolarAte("#perguntas");
          await t.realcar("#perguntas h2");
        }
      },
      {
        legenda: "Há quatro tipos: observe, interprete, no original e aplique.",
        faz: t => t.realcar("#perguntas .q-observation")
      },
      {
        legenda: "O versículo da pergunta leva direto ao texto.",
        faz: t => t.tocar("#perguntas .q-ref")
      },
      {
        legenda: "Na pergunta sobre o original, a palavra hebraica ou grega abre o verbete.",
        faz: async t => {
          await t.rolarAte("#perguntas .q-word");
          await t.tocar("#perguntas .q-word");
          await t.pausa(1500);
          await fecharPainel(t);
        }
      },
      {
        legenda: "Anotar resposta abre o painel do versículo, com a pergunta em cima.",
        faz: async t => {
          await t.rolarAte("#perguntas .q-note");
          await t.tocar("#perguntas .q-note");
          await t.digitar("#mb-note", "Rute escolhe ficar com Noemi e com o povo dela.");
        }
      },
      {
        legenda: "Toque em Pronto: a nota fica em Notas. Para esconder as perguntas: Aa › O que mostrar › Perguntas.",
        faz: async t => {
          await t.tocar(t.page.viewportSize().width <= 720 ? "#mb-done" : "#mb-close");
          await t.tocar("#open-look");
          await t.rolarAte("#t-questions");
          await t.realcar("#t-questions");
        }
      }
    ]
  },
  {
    id: "31",
    n: 31,
    grupo: "estudo",
    titulo: "Meu progresso",
    desc: "Capítulos lidos, tempo e plano de leitura.",
    inicio: "MAT.11",
    google: true,
    prepare: progressoDeExemplo,
    before: entrarNaConta,
    steps: [
      {
        legenda: "Em Livros, na aba Você, toque em Meu progresso (com a conta Google conectada).",
        faz: async t => {
          await abrirVoce(t);
          await t.tocar("#open-progress");
        }
      },
      {
        legenda: "Quanto da Bíblia você já leu, os dias seguidos e o tempo de leitura — somados em todos os seus aparelhos.",
        faz: t => t.realcar("#progresso .pg-tiles")
      },
      {
        legenda: "O gráfico mostra o tempo de leitura por dia; dá para ver o mês ou o ano.",
        faz: async t => {
          await t.rolarAte("#progresso .pg-chart");
          await t.tocar('#progresso [data-active-tab="mes"]');
        }
      },
      {
        legenda: "Cada livro aparece pintado pelo quanto já foi lido. Toque num livro…",
        faz: async t => {
          await t.rolarAte('#progresso [data-livro="MAT"]');
          await t.tocar('#progresso [data-livro="MAT"]');
        }
      },
      {
        legenda: "…para ver os capítulos. Um toque marca ou desmarca o capítulo como lido.",
        faz: t => t.tocar('#progresso [data-cap="11"]')
      },
      {
        legenda: "Volte e escolha um plano de leitura: a leitura de cada dia aparece aqui.",
        faz: async t => {
          await t.tocar("#pg-back");
          await t.rolarAte('#progresso [data-plano="ano"]');
          await t.tocar('#progresso [data-plano="ano"]');
          await t.rolarAte("#progresso .pg-day");
          await t.realcar("#progresso .pg-day");
        }
      }
    ]
  },
  {
    id: "32",
    n: 32,
    grupo: "estudo",
    titulo: "Buscar na Bíblia",
    desc: "Palavras, referências e números Strong.",
    inicio: "GEN.1",
    steps: [
      { legenda: "Toque na lupa, no topo.", faz: t => t.tocar("#open-search") },
      { legenda: "Digite palavras: acentos e maiúsculas não importam.", faz: t => t.digitar("#busca-q", "graca paz") },
      { legenda: "Aparecem os versículos com todas as palavras, já destacadas.", faz: t => t.realcar(".busca-item") },
      { legenda: "Filtre por testamento ou só no livro que você está lendo.", faz: t => t.tocar('.busca-scope [data-scope="nt"]') },
      { legenda: "Uma referência vira atalho: Sl 23.", faz: t => t.digitar("#busca-q", "Sl 23") },
      { legenda: "Toque para ir.", faz: t => t.tocar(".busca-go") }
    ]
  },
  {
    id: "33",
    n: 33,
    grupo: "estudo",
    titulo: "A palavra e a tradução",
    desc: "Ver no português o que cada palavra traduz.",
    inicio: "JHN.3",
    steps: [
      {
        legenda: "Abra uma palavra do original: a tradução dela fica destacada na Bíblia Livre.",
        faz: async t => {
          await t.rolarAte("#v16");
          await t.tocar('#v16 .word[data-i="2"]');
          await t.esperar(800);
          await t.tocar("#d-close");
        }
      },
      {
        legenda: "O contrário também: toque numa palavra da Bíblia Livre…",
        faz: async t => {
          await t.page.evaluate(() => document.querySelector("#v16 .blivre").scrollIntoView({ block: "center" }));
          await t.esperar(500);
          const p = await t.page.evaluate(() => {
            const bl = document.querySelector("#v16 .blivre");
            const w = document.createTreeWalker(bl, NodeFilter.SHOW_TEXT);
            for (let n = w.nextNode(); n; n = w.nextNode()) {
              const k = n.data.indexOf("Filho");
              if (k < 0) continue;
              const r = document.createRange();
              r.setStart(n, k + 1);
              r.setEnd(n, k + 3);
              const b = r.getBoundingClientRect();
              return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
            }
            return null;
          });
          await t.page.mouse.click(p.x, p.y);
        }
      },
      { legenda: "…e o cartão do original que ela traduz se acende.", faz: t => t.realcar("#v16 .word.linked") }
    ]
  },
  {
    id: "34",
    n: 34,
    grupo: "estudo",
    titulo: "Todas as ocorrências",
    desc: "Onde mais a Bíblia usa a mesma palavra.",
    inicio: "JHN.3",
    steps: [
      {
        legenda: "No verbete, toque em Ver as ocorrências.",
        faz: async t => {
          await t.rolarAte("#v16");
          await t.tocar('#v16 .word[data-i="2"]');
          await t.rolarAte("#d-conc");
          await t.tocar("#d-conc");
        }
      },
      { legenda: "A lista vem na ordem da Bíblia, com a palavra destacada em cada versículo.", faz: t => t.esperar(1200) },
      { legenda: "Filtre pela tradução: amou.", faz: t => t.tocar('#conc-gl .chip:has-text("amou")') },
      { legenda: "Ou só no livro que você está lendo.", faz: t => t.tocar('.conc-scope [data-scope="livro"]') },
      { legenda: "Toque num versículo para ir até ele.", faz: t => t.tocar(".conc-item") }
    ]
  },
  {
    id: "35",
    n: 35,
    grupo: "anotacoes",
    titulo: "Organizar as etiquetas",
    desc: "Renomear, juntar e apagar.",
    inicio: "GEN.1",
    prepare: dadosDeExemplo,
    steps: [
      { legenda: "Em Notas, as etiquetas aparecem como filtros.", faz: abrirMinhas },
      {
        legenda: "No menu ⋯, toque em Gerenciar etiquetas.",
        faz: async t => {
          await t.tocar("#mn-more summary");
          await t.tocar("#mn-manage");
        }
      },
      {
        legenda: "Mude o nome no campo. Dar o nome de outra etiqueta junta as duas.",
        faz: async t => {
          await t.digitar(".tm-name", "promessas de Deus");
          await t.page.keyboard.press("Enter");
          await t.esperar(600);
        }
      },
      { legenda: "Apagar pede dois toques e tira a etiqueta dos versículos.", faz: t => t.realcar(".tm-del") }
    ]
  },
  // Gravados à mão (telas do sistema): sequências de imagens com legenda em videos/manuais/.
  {
    id: "28",
    n: 28,
    grupo: "instalar",
    titulo: "Instalar na tela inicial",
    desc: "Android e iPhone, sem loja.",
    manual: true,
    steps: [
      { legenda: "Android (Chrome): abra o site, toque no menu ⋮ e em “Instalar app” ou “Adicionar à tela inicial”." },
      { legenda: "iPhone (Safari): toque em Compartilhar e em “Adicionar à Tela de Início”." },
      { legenda: "Pronto: o ícone abre a Bíblia em tela cheia, mesmo sem internet." }
    ]
  },
  {
    id: "29",
    n: 29,
    grupo: "instalar",
    titulo: "Instalar o APK",
    desc: "O app com a Bíblia inteira dentro.",
    manual: true,
    steps: [
      { legenda: "No celular Android, abra a página Releases › app-android do repositório." },
      { legenda: "Toque no arquivo .apk para baixar." },
      { legenda: "Abra o arquivo baixado e permita instalar apps desta fonte quando o Android pedir." },
      { legenda: "Toque em Instalar e depois em Abrir." }
    ]
  },
  {
    id: "30",
    n: 30,
    grupo: "instalar",
    titulo: "EPUB no Kindle",
    desc: "Pelo Send to Kindle.",
    manual: true,
    steps: [
      { legenda: "Baixe o EPUB na seção Baixar desta página (AT, NT ou um livro, se for mandar por e-mail)." },
      { legenda: "Abra o site ou app Send to Kindle da Amazon e envie o arquivo." },
      { legenda: "O livro aparece na biblioteca do Kindle; toque numa palavra do original para ver a nota." }
    ]
  }
];

// Só o que a página inicial precisa (sem as funções de ação).
export function storyboardSummary() {
  return {
    grupos,
    videos: videos.map(v => ({
      id: v.id,
      n: v.n,
      grupo: v.grupo,
      titulo: v.titulo,
      desc: v.desc,
      ready: v.ready !== false,
      steps: v.steps.map(p => p.legenda)
    }))
  };
}
