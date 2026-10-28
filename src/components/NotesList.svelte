<!--
  The list of Minhas anotações (#mn-items, in NotesSheet): cards per verse, grouped as src/state/notes.svelte.ts
  says. A card opens the item, or in selection mode (the PDF notebook) checks it.
-->
<script lang="ts">
  import { t } from "../i18n";
  import type { Item } from "../lib/annotations/list";
  import { notes } from "../state/notes.svelte";

  let { onitem }: { onitem: (item: Item) => void } = $props();
  const short = (s: string) => (s.length > 160 ? s.slice(0, 158) + "…" : s);
  function toggle(id: string) {
    notes.selected = notes.selected.includes(id) ? notes.selected.filter(x => x !== id) : [...notes.selected, id];
  }
</script>

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
