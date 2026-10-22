<!-- "Léxico do capítulo" (inside section#lexico): every lemma of the chapter, with a search. A row opens the entry. -->
<script lang="ts">
  import { t } from "../i18n";
  import { filterLexicon } from "../lib/chapter/lexicon";
  import { chapter } from "../state/chapter.svelte";
  import { reader } from "../state/reader.svelte";

  let { onopen }: { onopen: (key: string, row: HTMLButtonElement) => void } = $props();
  let query = $state("");
  const rows = $derived(filterLexicon(chapter.lexicon, query, chapter.lex));
</script>

<h2 id="lex-h">{t("lexicon.title")}</h2>
<p class="lede" id="lex-d">
  {#if reader.heading}{t("lexicon.lede", { count: chapter.lexicon.length, ref: `${reader.heading.book} ${reader.heading.chapter}` })}{/if}
</p>
<label class="sr" for="lsearch">{t("lexicon.search_label")}</label>
<input
  class="lsearch"
  id="lsearch"
  data-testid="lexicon-search"
  type="search"
  placeholder={t("lexicon.search_placeholder")}
  aria-describedby="lex-d lex-count"
  bind:value={query}
/>
<p class="sr" id="lex-count" aria-live="polite">{query.trim() ? t("lexicon.found", { count: rows.length }) : ""}</p>
<div class="llist" id="llist">
  {#each rows as r (r.key)}
    {@const number = r.key.startsWith("G:") ? "" : t("lexicon.row_strong", { strong: r.key })}
    <button
      type="button"
      class="lrow"
      data-ref={r.key}
      aria-label={t("lexicon.row_label", { strong: number, xlit: r.xlit, pron: r.pron, meaning: r.meaning, count: r.count })}
      onclick={e => onopen(r.key, e.currentTarget)}
      ><span class="ln" aria-hidden="true">{r.key.startsWith("G:") ? "—" : r.key}</span><span
        class="lh"
        class:grc={r.greek}
        lang={r.greek ? "grc" : "he"}
        aria-hidden="true">{r.lemma}</span
      ><span class="lx" aria-hidden="true">{r.xlit}</span><span class="ls" aria-hidden="true">{r.meaning} · {r.count}×</span></button
    >
  {:else}
    <p class="lempty">{t("lexicon.empty")}</p>
  {/each}
</div>
