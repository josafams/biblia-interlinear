<!-- "Exportar em PDF" (#exportar): what goes into the study notebook, what it includes and the order. -->
<script lang="ts">
  import { t } from "../i18n";
  import { exportView as v } from "../state/export.svelte";
  import Icon from "./Icon.svelte";

  let { onclose, ongenerate }: { onclose: () => void; ongenerate: () => void } = $props();
  let generate: HTMLButtonElement | undefined = $state();
  $effect(() => {
    if (v.open) generate?.focus();
  });
  const INCLUDE = [
    ["notes", "exp-notes", "notebook.include_notes"],
    ["highlights", "exp-highlights", "notebook.include_highlights"],
    ["favorites", "exp-favorites", "notebook.include_favorites"],
    ["text", "exp-text", "notebook.include_text"],
    ["interlinear", "exp-inter", "notebook.include_interlinear"]
  ] as const;
</script>

<!-- the same aside[role=dialog] as the other sheets (the styles and the tests expect it) -->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  id="exportar"
  class="sheet right mine-sheet"
  hidden={!v.open}
  role="dialog"
  aria-modal="true"
  aria-labelledby="exp-h"
  onkeydown={e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }}
>
  <div class="shead">
    <h2 id="exp-h">{t("notes.export")}</h2>
    <button class="ibtn" data-fechar aria-label={t("notebook.close")} onclick={onclose}><Icon name="close" size={18} /></button>
  </div>
  <div class="sgroup exp-body">
    <fieldset>
      <legend>{t("notebook.scope")}</legend>
      <label class="opt"
        ><input type="radio" name="exp-scope" value="lista" bind:group={v.scope} />
        <span>{t("notebook.scope_list")} <small id="exp-n-list">({v.listCount})</small></span></label
      >
      <label class="opt"
        ><input type="radio" name="exp-scope" value="sel" bind:group={v.scope} disabled={!v.selectedCount} />
        <span>{t("notebook.scope_selected")} <small id="exp-n-sel">({v.selectedCount})</small></span></label
      >
      <label class="opt"
        ><input type="radio" name="exp-scope" value="livro" bind:group={v.scope} disabled={!v.books.length} />
        <span
          >{t("notebook.scope_book")}
          <select id="exp-book" aria-label={t("notebook.book")} bind:value={v.book} onchange={() => (v.scope = "livro")}
            >{#each v.books as b (b.code)}<option value={b.code}>{b.name}</option>{/each}</select
          ></span
        ></label
      >
    </fieldset>
    <fieldset>
      <legend>{t("notebook.include")}</legend>
      {#each INCLUDE as [key, id, label] (id)}
        <label class="opt"><input type="checkbox" {id} bind:checked={v[key]} /> {t(label)}</label>
      {/each}
    </fieldset>
    <fieldset>
      <legend>{t("notes.order")}</legend>
      <label class="opt"><input type="radio" name="exp-order" value="biblica" bind:group={v.order} /> {t("notebook.order_bible")}</label>
      <label class="opt"><input type="radio" name="exp-order" value="data" bind:group={v.order} /> {t("notebook.order_date")}</label>
    </fieldset>
    <button class="exp-generate" id="exp-generate" bind:this={generate} disabled={v.busy} onclick={ongenerate}
      >{t(v.busy ? "notebook.generating" : "notebook.generate")}</button
    >
    <p class="exp-note" id="exp-note">{t("notebook.note")}</p>
  </div>
</aside>
