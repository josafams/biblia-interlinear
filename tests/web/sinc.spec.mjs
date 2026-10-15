// Sincronização das anotações pelo Drive entre vários "aparelhos" (contextos do navegador), com o Google simulado.
import { test, expect } from "@playwright/test";
import { simularGoogle, novaNuvem } from "./google-falso.mjs";

test.use({ serviceWorkers: "block" });
test.describe.configure({ timeout: 90000 });

// Abre um "aparelho" novo (contexto próprio: banco e aparelho próprios) ligado à mesma nuvem
async function aparelho(browser, nuvem, info, { atraso = 0 } = {}) {
  const u = info.project.use;
  const ctx = await browser.newContext({
    viewport: u.viewport, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor, isMobile: u.isMobile, hasTouch: u.hasTouch,
    locale: "pt-BR", baseURL: u.baseURL || "http://localhost:8790/", serviceWorkers: "block"
  });
  if (atraso) await ctx.addInitScript(d => { const real = Date.now; Date.now = () => real() + d; }, atraso);   // relógio do aparelho errado
  const page = await ctx.newPage();
  await simularGoogle(page, { nuvem });
  await page.goto("ler.html#GEN.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.waitForFunction(() => window.Conta && window.Sinc && window.Anotacoes);
  return page;
}
async function entrar(page) {
  await page.click("#open-toc");
  await page.click("#conta-entrar");
  await expect(page.locator("#conta-sinc")).toContainText("Sincronizado");
  await expect(page.locator(".conta-caixa")).toHaveCount(0);   // nada de pergunta: sincroniza sozinho
  await page.keyboard.press("Escape");
}
const sincronizar = page => page.evaluate(() => window.Sinc.agora());
const anc = (livro, cap, ver) => ({ livro, cap, ver, ver_fim: ver, camada: "versiculo" });
const gravar = (page, col, reg) => page.evaluate(([c, r]) => window.Anotacoes.gravar(c, r).then(x => x.id), [col, reg]);
const ler = (page, col) => page.evaluate(c => window.Anotacoes.todos(c), col);

test("anotação feita num aparelho aparece no outro, e a edição volta", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, nuvem, info);
  const b = await aparelho(browser, nuvem, info);
  await entrar(a); await entrar(b);
  const id = await gravar(a, "notas", { id: "n1", cap: "GEN.1", ancora: anc("GEN", 1, 1), titulo: "No princípio", texto: "Bereshit." });
  await gravar(a, "marcacoes", { id: "m1", cap: "GEN.1", ancora: anc("GEN", 1, 3), cor: "amarelo", etiquetas: [] });
  await sincronizar(a);
  expect(nuvem.nomes("lote-")).toHaveLength(1);
  await sincronizar(b);
  expect((await ler(b, "notas")).map(n => n.titulo)).toEqual(["No princípio"]);
  await expect(b.locator("#v3")).toHaveClass(/mk-amarelo/);     // pintado na tela, sem recarregar
  // editar no B volta para o A
  await gravar(b, "notas", { id, texto: "Bereshit bara Elohim." });
  await sincronizar(b); await sincronizar(a);
  expect((await ler(a, "notas"))[0].texto).toBe("Bereshit bara Elohim.");
  // apagar também sincroniza
  await a.evaluate(() => window.Anotacoes.apagar("marcacoes", "m1"));
  await sincronizar(a); await sincronizar(b);
  expect(await ler(b, "marcacoes")).toHaveLength(0);
  await expect(b.locator("#v3")).not.toHaveClass(/mk-amarelo/);
});

test("a sincronização roda sozinha alguns segundos depois de anotar", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, nuvem, info);
  await entrar(a);
  await gravar(a, "favoritos", { id: "f1", cap: "PSA.23", ancora: anc("PSA", 23, 1) });
  await expect.poll(() => nuvem.nomes("lote-").length, { timeout: 10000 }).toBe(1);
});

test("primeiro login envia sozinho o que já foi anotado no aparelho", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, nuvem, info);
  await gravar(a, "favoritos", { id: "f1", cap: "JHN.3", ancora: anc("JHN", 3, 16) });
  await gravar(a, "notas", { id: "n1", cap: "JHN.3", ancora: anc("JHN", 3, 16), titulo: "", texto: "Amou o mundo." });
  await entrar(a);
  const lote = nuvem.json(nuvem.nomes("lote-")[0]);
  expect(lote.colecoes.favoritos.map(r => r.id)).toEqual(["f1"]);
  expect(lote.colecoes.notas.map(r => r.id)).toEqual(["n1"]);
  // e junta com o que a conta já tinha de outro aparelho
  const b = await aparelho(browser, nuvem, info);
  await gravar(b, "favoritos", { id: "f2", cap: "JHN.1", ancora: anc("JHN", 1, 1) });
  await entrar(b);
  expect((await ler(b, "favoritos")).map(f => f.id).sort()).toEqual(["f1", "f2"]);
  await sincronizar(a);
  expect((await ler(a, "favoritos")).map(f => f.id).sort()).toEqual(["f1", "f2"]);
});

test("nota editada nos dois aparelhos ao mesmo tempo vira duas, sem perder texto", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, nuvem, info);
  const b = await aparelho(browser, nuvem, info);
  await entrar(a); await entrar(b);
  await gravar(a, "notas", { id: "n1", cap: "ROM.8", ancora: anc("ROM", 8, 28), titulo: "Rm 8", texto: "original" });
  await sincronizar(a); await sincronizar(b);
  // os dois sem internet editam a mesma nota
  await a.context().setOffline(true); await b.context().setOffline(true);
  await gravar(a, "notas", { id: "n1", texto: "versão do celular" });
  await gravar(b, "notas", { id: "n1", texto: "versão do computador" });
  await a.context().setOffline(false); await b.context().setOffline(false);
  await sincronizar(a); await sincronizar(b); await sincronizar(a);
  for (const p of [a, b]) {
    const notas = await ler(p, "notas");
    expect(notas.map(n => n.texto).sort()).toEqual(["versão do celular", "versão do computador"]);
    expect(notas.filter(n => /\(conflito de \d\d\/\d\d\)/.test(n.titulo))).toHaveLength(1);
  }
});

test("aparelho com o relógio atrasado não desfaz a edição mais nova", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, nuvem, info);
  const b = await aparelho(browser, nuvem, info, { atraso: -3 * 864e5 });   // 3 dias atrás
  await entrar(a); await entrar(b);
  await gravar(a, "marcacoes", { id: "m1", cap: "GEN.1", ancora: anc("GEN", 1, 1), cor: "amarelo", etiquetas: [] });
  await sincronizar(a); await sincronizar(b);
  // depois de ver a mudança do A, o B troca a cor: vale a do B, mesmo com o relógio dele atrasado
  await gravar(b, "marcacoes", { id: "m1", cor: "verde" });
  await sincronizar(b); await sincronizar(a);
  expect((await ler(a, "marcacoes"))[0].cor).toBe("verde");
});

test("compactação: retrato com tudo, lotes antigos apagados, aparelho novo começa pelo retrato", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, nuvem, info);
  await entrar(a);
  for (let i = 1; i <= 3; i++) { await gravar(a, "favoritos", { id: "f" + i, cap: "PSA." + i, ancora: anc("PSA", i, 1) }); await sincronizar(a); }
  await gravar(a, "favoritos", { id: "f1", apagado: true });
  await sincronizar(a);
  expect(nuvem.nomes("lote-")).toHaveLength(4);
  nuvem.envelhecer("lote-", 40);   // todos com mais de 30 dias
  await gravar(a, "favoritos", { id: "f4", cap: "PSA.4", ancora: anc("PSA", 4, 1) });
  await sincronizar(a);             // um lote recente, que não pode ser apagado
  await a.evaluate(() => window.Sinc.compactar());
  expect(nuvem.nomes("retrato-")).toHaveLength(1);
  expect(nuvem.nomes("lote-")).toHaveLength(1);
  const ret = nuvem.json(nuvem.nomes("retrato-")[0]);
  expect(ret.colecoes.favoritos.map(f => f.id).sort()).toEqual(["f1", "f2", "f3", "f4"]);   // f1 apagado há pouco ainda vai (como exclusão)
  // aparelho novo
  const c = await aparelho(browser, nuvem, info);
  await entrar(c);
  expect((await ler(c, "favoritos")).map(f => f.id).sort()).toEqual(["f2", "f3", "f4"]);
});

test("o modo de leitura escolhido num aparelho vale no outro", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, nuvem, info);
  const b = await aparelho(browser, nuvem, info);
  await entrar(a); await entrar(b);
  await a.evaluate(() => { document.getElementById("open-look").click(); });
  await a.click('.mcard[data-modo="biblia"]');
  await sincronizar(a); await sincronizar(b);
  expect(await b.evaluate(() => localStorage.getItem("interlinear:modo"))).toBe("biblia");
  await expect(b.locator("body")).toHaveClass(/hide-orig/);
});

test("sair apagando deste aparelho e apagar os dados do Google Drive", async ({ browser }, info) => {
  const nuvem = novaNuvem();
  const a = await aparelho(browser, nuvem, info);
  await entrar(a);
  await gravar(a, "favoritos", { id: "f1", cap: "GEN.1", ancora: anc("GEN", 1, 1) });
  await sincronizar(a);
  // apagar da nuvem: some do Drive, fica no aparelho
  await a.click("#open-toc");
  await a.click("#conta-apagar-nuvem");
  await a.click('.conta-caixa button[data-r="sim"]');
  await expect(a.locator("#conta-entrar")).toContainText("Entrar com Google");
  expect(nuvem.arquivos.size).toBe(0);
  expect(await a.evaluate(() => window.Anotacoes.contar())).toBe(1);
  // entrar de novo (envia de novo, sozinho) e sair apagando deste aparelho
  await a.click("#conta-entrar");
  await expect(a.locator("#conta-sinc")).toContainText("Sincronizado");
  expect(nuvem.nomes("lote-")).toHaveLength(1);
  await a.click("#conta-sair");
  await a.click('.conta-caixa button[data-r="apagar"]');
  await expect(a.locator("#conta-entrar")).toContainText("Entrar com Google");
  expect(await a.evaluate(() => window.Anotacoes.contar())).toBe(0);
  expect(nuvem.nomes("lote-")).toHaveLength(1);   // a nuvem continua com tudo
});
