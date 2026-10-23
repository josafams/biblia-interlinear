<!--
  The top of the index (#toc): the ✕ on the tabs row, the title for screen readers and the tabs
  Livros · Notas · Você. Notas opens "Minhas anotações"; the other two switch the part shown.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { toc } from "../state/toc.svelte";
  import NotesCount from "./NotesCount.svelte";

  let { onpick }: { onpick: (tab: "livros" | "notas" | "voce") => void } = $props();
  const TABS = [
    ["livros", "bar.books"],
    ["notas", "bar.notes"],
    ["voce", "notes.you"]
  ] as const;
</script>

<button class="ibtn toc-x" data-close aria-label={t("index.close")}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
</button>
<div class="shead"><h2 id="toc-h">{t("index.title")}</h2></div>
<nav class="toc-tabs" aria-label={t("notes.index_parts")}>
  {#each TABS as [id, label] (id)}
    <a
      href="#toc-{id}"
      data-tab
      id={id === "notas" ? "tab-notas" : undefined}
      aria-current={toc.tab === id ? "true" : undefined}
      onclick={e => {
        e.preventDefault();
        onpick(id);
      }}
      >{t(label)}{#if id === "notas"}<span id="tab-notas-n"><NotesCount /></span>{/if}</a
    >
  {/each}
</nav>
