<!--
  Livros in the index (section.toc-books): Antigo / Novo Testamento and the books by group. Typing a name in
  "Ir para" shows the matching books of both testaments (#bk-list[data-filtro], CSS).
-->
<script lang="ts">
  import { t } from "../i18n";
  import { type IndexBook, bookGroups, bookMatches } from "../lib/books";
  import { toc } from "../state/toc.svelte";

  let { books, onpick }: { books: IndexBook[]; onpick: (code: string) => void } = $props();
  const groups = $derived(bookGroups(books));
  const visible = $derived(groups.map(g => g.books.filter(b => bookMatches(b, toc.filter))));
  const anyVisible = $derived(visible.some(l => l.length));
</script>

<h3 id="bk-h" class="sr">{t("index.books")}</h3>
<div class="seg2" id="bk-testa" role="radiogroup" aria-label={t("index.testament")}>
  <button type="button" role="radio" data-nt="0" aria-checked={toc.testament === "0"} onclick={() => (toc.testament = "0")}
    >{t("index.old_testament")}</button
  >
  <button type="button" role="radio" data-nt="1" aria-checked={toc.testament === "1"} onclick={() => (toc.testament = "1")}
    >{t("index.new_testament")}</button
  >
</div>
<div id="bk-list" data-testid="book-list" data-nt={toc.testament} data-filtro={toc.filter && anyVisible ? "1" : ""}>
  {#each groups as g, k (g.name + g.nt)}
    <div class="bgroup" data-nt={g.nt ? 1 : 0} hidden={!visible[k].length}>
      <h4>{g.name}</h4>
      <div class="bgrid">
        {#each g.books as b (b.code)}
          <button
            class="bchip"
            data-cod={b.code}
            aria-pressed={b.code === toc.book}
            aria-label={b.name}
            hidden={!visible[k].includes(b)}
            onclick={() => onpick(b.code)}
            ><span class="bn">{b.name}</span><span class="ba" aria-hidden="true"
              >{t("index.chapter_count", { count: b.chapters.length })}</span
            ></button
          >
        {/each}
      </div>
    </div>
  {/each}
</div>
