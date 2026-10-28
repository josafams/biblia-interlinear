<!--
  The filters of Minhas anotações (in NotesSheet): by kind (notes, highlights, favorites) and by tag, with the
  count of each. A change calls onchange to list again.
-->
<script lang="ts">
  import { t } from "../i18n";
  import type { Kind } from "../lib/annotations/list";
  import { notes } from "../state/notes.svelte";

  let { onchange }: { onchange: () => void } = $props();
  const KINDS: ("" | Kind)[] = ["", "notas", "marcacoes", "favoritos"];
</script>

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
