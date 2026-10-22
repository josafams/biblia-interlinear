// Meu progresso: capítulo lido, tempo ativo, soma entre aparelhos, sequência, mapa, plano de leitura — com o Google simulado.
import { test, expect } from "@playwright/test";
import { simularGoogle, novaNuvem } from "./fake-google.mjs";

test.use({ serviceWorkers: "block" });
test.describe.configure({ timeout: 90000 });

// contagem acelerada: 1 "segundo" de leitura mínima, verificação a cada 200 ms, sem gesto = parado depois de 1,5 s
const RAPIDO = { tick: 200, minReading: 1, gesture: 1500, saveEvery: 1000 };

async function aparelho(browser, info, nuvem, { config = RAPIDO, timezoneId } = {}) {
  const u = info.project.use;
  const ctx = await browser.newContext({
    viewport: u.viewport,
    userAgent: u.userAgent,
    deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile,
    hasTouch: u.hasTouch,
    locale: "pt-BR",
    baseURL: u.baseURL || "http://localhost:8790/",
    serviceWorkers: "block",
    timezoneId
  });
  await ctx.addInitScript(c => {
    window.__progressConfig = c;
    try {
      localStorage.setItem("interlinear:conta-sugestao", "nao");
    } catch (_) {}
  }, config);
  const page = await ctx.newPage();
  await simularGoogle(page, { nuvem });
  await page.goto("ler.html#RUT.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.waitForFunction(() => window.Progress && window.Account && window.Sync);
  return page;
}
async function signIn(page) {
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-voce"]');
  await page.click("#account-signin");
  await expect(page.locator("#account-sync")).toContainText("Sincronizado", { timeout: 20000 });
  await page.keyboard.press("Escape");
}
async function abrirProgresso(page) {
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-voce"]');
  await page.click("#open-progress");
  await expect(page.locator("#progresso")).toBeVisible();
}
const hojeNa = page =>
  page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

test("sem conta, Meu progresso convida a entrar e não conta nada", async ({ browser }, info) => {
  const page = await aparelho(browser, info, novaNuvem());
  await page.mouse.wheel(0, 20000);
  await page.waitForTimeout(1200);
  await abrirProgresso(page);
  await expect(page.locator("#progresso")).toContainText("Entre com sua conta Google");
  await expect(page.locator("#progresso .js-signin")).toBeVisible();
  expect(await page.evaluate(() => window.Annotations.allRecords("leituras"))).toHaveLength(0);
});

test("uma rolagem longa que passa do último versículo também marca como lido", async ({ browser }, info) => {
  const page = await aparelho(browser, info, novaNuvem());
  await signIn(page);
  // salta direto para o fim da página: o último versículo nunca cruza a tela
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.mouse.wheel(0, 10);
  await expect
    .poll(() => page.evaluate(() => window.Annotations.allRecords("leituras").then(l => l.map(x => x.id))), { timeout: 8000 })
    .toEqual(["RUT.1"]);
});

test("ler até o fim do capítulo marca como lido e conta o tempo", async ({ browser }, info) => {
  const page = await aparelho(browser, info, novaNuvem());
  await signIn(page);
  // rola até o último versículo de Rute 1 e continua "lendo" (gestos) por alguns instantes
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(300);
  }
  await expect
    .poll(() => page.evaluate(() => window.Annotations.allRecords("leituras").then(l => l.map(x => x.id))), { timeout: 8000 })
    .toEqual(["RUT.1"]);
  await abrirProgresso(page);
  await expect(page.locator("#progresso .pg-big").first()).toContainText("1 de 1.189 capítulos lidos");
  await expect(page.locator('.pg-book[data-livro="RUT"]')).toHaveClass(/n1/);
  const tempo = await page.evaluate(() => window.Annotations.allRecords("tempo"));
  expect(tempo).toHaveLength(1);
  expect(tempo[0].segundos).toBeGreaterThan(0);
  expect(tempo[0].livros.RUT).toBeGreaterThan(0);
  // o livro: capítulo 1 lido; marcar o 2 à mão
  await page.click('.pg-book[data-livro="RUT"]');
  await expect(page.locator('.pg-chapter[data-cap="1"]')).toHaveAttribute("aria-pressed", "true");
  await page.click('.pg-chapter[data-cap="2"]');
  await expect(page.locator('.pg-chapter[data-cap="2"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#progresso .pg-big")).toHaveText(/^2\s*de 4 capítulos lidos$/);
  await page.click('.pg-chapter[data-cap="2"]'); // e desmarcar
  await expect(page.locator("#progresso .pg-big")).toHaveText(/^1\s*de 4 capítulos lidos$/);
});

test("sem atividade (nem rolar, nem tocar), o tempo para de contar", async ({ browser }, info) => {
  const page = await aparelho(browser, info, novaNuvem());
  await signIn(page);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2500); // o gesto "vale" por 1,5 s
  const t1 = await page.evaluate(() =>
    window.Progress.saveTime()
      .then(() => window.Annotations.allRecords("tempo"))
      .then(t => t[0]?.segundos || 0)
  );
  await page.waitForTimeout(2000);
  const t2 = await page.evaluate(() =>
    window.Progress.saveTime()
      .then(() => window.Annotations.allRecords("tempo"))
      .then(t => t[0]?.segundos || 0)
  );
  expect(t1).toBeGreaterThan(0);
  expect(t2).toBe(t1);
});

test("o tempo de dois aparelhos no mesmo dia é somado, não sobrescrito", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, info, nuvem);
  const b = await aparelho(browser, info, nuvem);
  await signIn(a);
  await signIn(b);
  const dia = await hojeNa(a);
  for (const [p, sec] of [
    [a, 600],
    [b, 900]
  ]) {
    await p.evaluate(
      ([dia, sec]) =>
        window.Annotations.save("tempo", {
          id: `${window.Annotations.storage.aparelho}:${dia}`,
          aparelho: window.Annotations.storage.aparelho,
          dia,
          segundos: sec,
          livros: { RUT: sec },
          caps: 0,
          verbetes: 2
        }),
      [dia, sec]
    );
    await p.evaluate(() => window.Sync.currentTime());
  }
  await a.evaluate(() => window.Sync.currentTime());
  await abrirProgresso(a);
  await expect(a.locator(".pg-tile").nth(1)).toContainText("25 min"); // 10 + 15 nos últimos 7 dias
  await expect(a.locator(".pg-tile").nth(3)).toContainText("4"); // verbetes: 2 + 2
});

test("sequência de dias e recorde", async ({ browser }, info) => {
  const page = await aparelho(browser, info, novaNuvem());
  await signIn(page);
  await page.evaluate(async () => {
    const d0 = new Date(),
      dia = n => {
        const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
    const ap = window.Annotations.storage.aparelho;
    // ontem, anteontem e 3 dias atrás (5 min cada) = sequência 3; antes, 4 dias seguidos = recorde 4; 1 dia só com 2 min não conta
    for (const n of [1, 2, 3, 10, 11, 12, 13])
      await window.Annotations.save("tempo", {
        id: `${ap}:${dia(n)}`,
        aparelho: ap,
        dia: dia(n),
        segundos: 300,
        livros: {},
        caps: 0,
        verbetes: 0
      });
    await window.Annotations.save("tempo", {
      id: `${ap}:${dia(5)}`,
      aparelho: ap,
      dia: dia(5),
      segundos: 120,
      livros: {},
      caps: 0,
      verbetes: 0
    });
  });
  await abrirProgresso(page);
  await expect(page.locator(".pg-tile").first()).toContainText("3 dias");
  await expect(page.locator(".pg-tile").first()).toContainText("recorde 4");
});

test("plano de leitura: leitura do dia, em dia ou atrasado, reajustar", async ({ browser }, info) => {
  const page = await aparelho(browser, info, novaNuvem());
  await signIn(page);
  await abrirProgresso(page);
  await page.click('[data-plano="ano"]');
  await expect(page.locator("#progresso")).toContainText("Bíblia em 1 ano");
  await expect(page.locator(".pg-day button")).toHaveText(["Gn 1", "Gn 2", "Gn 3"]);
  await expect(page.locator(".pg-status")).toHaveText("Em dia");
  // o plano começou há 10 dias e nada foi lido: atrasado
  await page.evaluate(async () => {
    const p = (await window.Annotations.allRecords("planos"))[0];
    const d = n => {
      const x = new Date();
      x.setDate(x.getDate() + n);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    };
    await window.Annotations.save("planos", { ...p, inicio: d(-10), fim: d(354) });
  });
  await expect(page.locator(".pg-status")).toContainText("capítulos atrasado");
  await page.click("#pg-readjust");
  await expect(page.locator(".pg-status")).toHaveText("Em dia");
  await expect(page.locator(".pg-day button").first()).toHaveText("Gn 1");
  // tocar na leitura do dia abre o capítulo
  await page.click('.pg-day button[data-ir="GEN.1"]');
  await expect(page.locator("#progresso")).toBeHidden();
  await expect(page).toHaveURL(/GEN\.1/);
});

test("zerar estatísticas apaga leituras, tempo e plano, mas não as anotações", async ({ browser }, info) => {
  const page = await aparelho(browser, info, novaNuvem());
  await signIn(page);
  await page.evaluate(async () => {
    await window.Progress.markRead("RUT", 1);
    await window.Annotations.save("favoritos", {
      id: "f1",
      cap: "RUT.1",
      ancora: { livro: "RUT", cap: 1, ver: 1, ver_fim: 1, camada: "versiculo" }
    });
  });
  await abrirProgresso(page);
  await page.click('[data-plano="nt90"]');
  await page.click("#pg-reset");
  await page.click('.account-box button[data-r="sim"]');
  await expect(page.locator("#progresso .pg-big").first()).toContainText("0 de 1.189");
  await expect(page.locator('[data-plano="ano"]')).toBeVisible();
  expect(await page.evaluate(() => window.Annotations.countAll())).toBe(1);
});

test("foto (só com FOTOS=pasta)", async ({ browser }, info) => {
  test.skip(!process.env.FOTOS);
  const page = await aparelho(browser, info, novaNuvem());
  await signIn(page);
  await page.evaluate(async () => {
    const A = window.Annotations,
      ap = A.storage.aparelho,
      d0 = new Date();
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
          livros: { GEN: 600 },
          caps: 2,
          verbetes: 3
        });
    for (let c = 1; c <= 50; c++) await window.Progress.markRead("GEN", c);
    for (const l of ["RUT", "JON", "PHM", "JUD", "OBA"]) {
      const n = window.__books[l].chapterCount;
      for (let c = 1; c <= n; c++) await window.Progress.markRead(l, c);
    }
    for (let c = 1; c <= 10; c++) await window.Progress.markRead("MAT", c);
    await A.save("preferencias", { id: "posicao", cod: "MAT", cap: 11, quando: new Date().toISOString() });
  });
  await abrirProgresso(page);
  await page.click('[data-plano="ano"]');
  await page.evaluate(() => {
    document.getElementById("toast").hidden = true;
    document.getElementById("progresso").scrollTop = 0;
  });
  await page.screenshot({ path: `${process.env.FOTOS}/progresso-${info.project.name}.png`, fullPage: false });
  await page.locator("#progresso .pg-map").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${process.env.FOTOS}/progresso2-${info.project.name}.png` });
  await page.click('.pg-book[data-livro="MAT"]');
  await page.screenshot({ path: `${process.env.FOTOS}/progresso-livro-${info.project.name}.png` });
});
