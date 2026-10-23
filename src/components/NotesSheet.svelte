<!--
  Minhas anotações (#minhas), the Notas tab of the index: the index tabs, search, filters by kind and tag, the
  list in cards per verse, selection for the PDF notebook and the ⋯ menu (export, backup, import, tags).
  src/reader/annotations/list.ts loads the records into src/state/notes.svelte.ts and does the actions through the props.
-->
<script lang="ts">
  import { t } from "../i18n";
  import type { Item, Kind } from "../lib/annotations/list";
  import { annotated } from "../state/annotations.svelte";
  import { notes } from "../state/notes.svelte";

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
  const KINDS: ("" | Kind)[] = ["", "notas", "marcacoes", "favoritos"];
  const menu = (a: MenuAction) => {
    if (more) more.open = false;
    onmenu(a);
  };
  const short = (s: string) => (s.length > 160 ? s.slice(0, 158) + "…" : s);
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
  function toggle(id: string) {
    notes.selected = notes.selected.includes(id) ? notes.selected.filter(x => x !== id) : [...notes.selected, id];
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
  <button class="ibtn toc-x" data-fechar aria-label={t("annotate.close")} onclick={onclose}
    ><svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
    ></button
  >
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
    <div class="mn-filters" role="group" aria-label={t("notes.kind")}>
      {#each KINDS as k (k)}
        <button
          class="chip"
          data-tipo={k}
          aria-pressed={notes.filter.tipo === k}
          onclick={() => {
            notes.filter.tipo = k;
            onchange();
          }}>{t(`notes.kinds.${k || "all"}`)} <small>{notes.counts[k]}</small></button
        >
      {/each}
    </div>
    <div class="mn-tagchips" id="mn-tags" role="group" aria-label={t("notes.by_tag")}>
      {#each notes.tags as tag (tag.id)}
        <button
          class="chip"
          data-tagf={tag.id}
          aria-pressed={notes.filter.tag === tag.id}
          onclick={() => {
            notes.filter.tag = notes.filter.tag === tag.id ? "" : tag.id;
            onchange();
          }}>{tag.nome} <small>{tag.count}</small></button
        >
      {/each}
    </div>
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
    <div id="mn-items">
      {#each notes.groups as g, gi (gi)}
        {#if g.title}<h3 class="mn-group">{g.title}</h3>{/if}
        {#each g.verses as v (v.key)}
          <div class="mn-verse">
            <span class="mn-ref">{v.ref}</span>
            {#each v.items as x (x.id)}
              <button
                class="mn-item"
                class:sel={notes.selecting}
                data-tipo={x.tipo}
                data-id={x.id}
                role={notes.selecting ? "checkbox" : undefined}
                aria-checked={notes.selecting ? notes.selected.includes(x.id) : undefined}
                onclick={() => (notes.selecting ? toggle(x.id) : onitem(x))}
              >
                <span class="mn-line"
                  >{#if x.color}<span class="mn-color mk-{x.color}">{x.label}</span>{:else}<span class="mn-kind">{x.label}</span
                    >{/if}{#if x.title}
                    <b class="mn-title">{x.title}</b>{/if}<span class="sr"> · {x.ref}</span></span
                >
                {#if x.text}<span class="mn-txt">{short(x.text)}</span>{/if}
                {#if x.tagNames.length}<span class="mn-tags"
                    >{#each x.tagNames as n, k (k)}<span class="chip">{n}</span>{/each}</span
                  >{/if}
              </button>
            {/each}
          </div>
        {/each}
      {:else}
        <p class="mn-empty">{t(notes.any ? "notes.nothing_found" : "notes.empty")}</p>
      {/each}
    </div>
  </div>
</aside>
