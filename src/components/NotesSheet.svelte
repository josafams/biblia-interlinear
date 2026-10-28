<!--
  Minhas anotações (#minhas), the Notas tab of the index: the index tabs, search, filters by kind and tag, the
  list in cards per verse, selection for the PDF notebook and the ⋯ menu (export, backup, import, tags).
  src/reader/annotations/list.ts loads the records into src/state/notes.svelte.ts and does the actions through the props.
-->
<script lang="ts">
  import { t } from "../i18n";
  import type { Item } from "../lib/annotations/list";
  import { annotated } from "../state/annotations.svelte";
  import { notes } from "../state/notes.svelte";
  import Icon from "./Icon.svelte";
  import NotesFilters from "./NotesFilters.svelte";
  import NotesList from "./NotesList.svelte";

  type MenuAction = "select" | "export" | "download" | "import" | "manage";
  let {
    onclose,
    onchange,
    onitem,
    onnew,
    onmenu,
    onimport,
    ontab
  }: {
    onclose: () => void;
    /** filters, search or order changed: list again */
    onchange: () => void;
    onitem: (item: Item) => void;
    onnew: () => void;
    onmenu: (action: MenuAction) => void;
    /** "Importar": the file picked */
    onimport: (file: File) => void;
    ontab: (tab: "livros" | "voce") => void;
  } = $props();
  let more: HTMLDetailsElement | undefined = $state();
  const menu = (a: MenuAction) => {
    if (more) more.open = false;
    onmenu(a);
  };
  const total = $derived(
    notes.selecting && notes.selected.length
      ? t("notes.selected", { count: notes.selected.length })
      : notes.filter.cap
        ? t("notes.in_verse", { count: notes.shown })
        : t("notes.items", { count: notes.shown })
  );
  function keydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<!-- the same aside[role=dialog] as the other sheets (the styles and the tests expect it) -->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  id="minhas"
  class="sheet right mine-sheet"
  data-testid="notes-sheet"
  hidden={!notes.open}
  role="dialog"
  aria-modal="true"
  aria-labelledby="mine-h"
  tabindex="-1"
  onkeydown={keydown}
>
  <button class="ibtn toc-x" data-fechar aria-label={t("annotate.close")} onclick={onclose}><Icon name="close" size={18} /></button>
  <nav class="mn-tabs" aria-label={t("notes.index_parts")}>
    <a
      href="#toc-livros"
      data-tab
      onclick={e => {
        e.preventDefault();
        ontab("livros");
      }}>{t("index.books")}</a
    >
    <a href="#toc-notas" data-tab aria-current="true" onclick={e => e.preventDefault()}
      >{t("bar.notes")}{annotated.verses ? ` · ${annotated.verses}` : ""}</a
    >
    <a
      href="#toc-voce"
      data-tab
      onclick={e => {
        e.preventDefault();
        ontab("voce");
      }}>{t("notes.you")}</a
    >
  </nav>
  <div class="shead"><h2 id="mine-h">{t("bar.notes_label")}</h2></div>
  <div class="sgroup">
    <label class="sr" for="mn-search">{t("notes.search_label")}</label>
    <div class="mn-searchrow">
      <input
        id="mn-search"
        class="lsearch"
        type="search"
        placeholder={t("notes.search_placeholder")}
        autocomplete="off"
        bind:value={notes.filter.query}
        oninput={onchange}
      />
      <details class="mn-more" id="mn-more" bind:this={more}>
        <summary aria-label={t("notes.more")}>⋯</summary>
        <div class="mn-menu">
          <button id="mn-select" aria-pressed={notes.selecting} onclick={() => menu("select")}>{t("notes.select")}</button>
          <button id="mn-export" onclick={() => menu("export")}>{t("notes.export")}</button>
          <button id="mn-download" onclick={() => menu("download")}>{t("notes.download")}</button>
          <button id="mn-import" onclick={() => menu("import")}>{t("notes.import")}</button>
          <button id="mn-manage" onclick={() => menu("manage")}>{t("tags.manage")}</button>
        </div>
      </details>
    </div>
    <NotesFilters {onchange} />
    <div class="mn-actions">
      <button class="mn-new" id="mn-new" onclick={onnew}>{t("notes.new_free")}</button>
      <span id="mn-total" aria-live="polite"
        >{total}{#if notes.filter.cap && !(notes.selecting && notes.selected.length)}<button
            class="linklike"
            id="mn-see-all"
            onclick={() => {
              notes.filter.cap = null;
              notes.filter.ver = null;
              onchange();
            }}>{t("notes.see_all")}</button
          >{/if}</span
      >
      <label class="mn-order"
        ><span class="sr">{t("notes.order")}</span><select id="mn-order" bind:value={notes.order} {onchange}
          ><option value="biblica">{t("notes.order_bible")}</option><option value="data">{t("notes.order_recent")}</option></select
        ></label
      >
      <input
        type="file"
        id="mn-file"
        accept=".json,application/json"
        hidden
        onchange={e => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = "";
          if (file) onimport(file);
        }}
      />
    </div>
    <div class="mn-manage" id="mn-tagmgr" hidden></div>
    <NotesList {onitem} />
  </div>
</aside>
