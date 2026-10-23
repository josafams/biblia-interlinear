<!--
  One verse: number, the ⋯ button (annotate, listen), the word cards, the Bíblia Livre text and the points of the
  automatic review, and what is annotated on it (src/state/marks.svelte.ts): colors, the note button and the
  strip under it.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { type VerseView, wordCardsHTML } from "../lib/chapter/view";
  import { textPieces } from "../lib/annotations/paint";
  import { COLOR_IDS } from "../state/annotate.svelte";
  import { chapter, fillWhenNear, wordsOf } from "../state/chapter.svelte";
  import { marks } from "../state/marks.svelte";
  import Icon from "./Icon.svelte";

  let { v }: { v: VerseView } = $props();
  const filled = $derived(chapter.filled[v.vi]);
  const [cap, num] = $derived(v.label.includes(":") ? v.label.split(":") : [null, v.label]);

  const m = $derived(marks.byVerse[v.n]);
  const pieces = $derived(textPieces(v.blivre, m?.spans || []));
  const strip = $derived(!!m && (m.favorite || !!m.firstNote || m.tags.length > 0));

  // the word cards are HTML (see below): their highlight classes are set on the buttons
  function wordColors(el: HTMLElement) {
    const words = m?.words || {};
    for (const b of el.querySelectorAll<HTMLElement>(".word")) {
      b.classList.remove(...COLOR_IDS.map(c => "mk-" + c));
      const c = words[+b.dataset.i!];
      if (c) b.classList.add("mk-" + c);
    }
  }

  function lazy(el: HTMLElement) {
    if (chapter.filled[v.vi]) return;
    return fillWhenNear(el, v.vi);
  }
</script>

<section
  class="verse"
  class:mk-amarelo={m?.color === "amarelo"}
  class:mk-verde={m?.color === "verde"}
  class:mk-azul={m?.color === "azul"}
  class:mk-rosa={m?.color === "rosa"}
  class:mk-laranja={m?.color === "laranja"}
  class:mk-deslocada={m?.displaced}
  class:com-cor={!!m?.bar}
  style:--barcor={m?.bar ? `var(--mk-${m.bar})` : undefined}
  id="v{v.n}"
  data-vi={v.vi}
  aria-labelledby="vh{v.n}"
>
  <div class="vhead">
    <h3 class="vnum" class:has-rev={v.hasMarks} id="vh{v.n}">
      <span class="sr">{t("verse.sr")}</span>{#if cap}<span class="vcap">{cap}:</span>{num}{:else}{v.label}{/if}{#if v.hasMarks}<span
          class="sr">{t("verse.review_sr")}</span
        >{/if}
    </h3>
    <span class="vtags"
      >{#if m?.notes}<button class="vnota" data-ver={v.n} aria-label={t("verse.notes_label", { count: m.notes })}
          ><Icon name="note" /><span aria-hidden="true">{m.notes > 1 ? m.notes : ""}</span></button
        >{/if}</span
    >
    <button class="vmark" data-verse={v.vi} aria-label={t("verse.mark_label", { ref: v.label })}
      ><svg class="vm-dots" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"
        ><path
          d="M3.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M10.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M17.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0"
        /></svg
      ><svg
        class="vm-pen"
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg
      ><span class="vm-t" aria-hidden="true">{t("verse.mark")}</span></button
    >
  </div>
  {#if v.wordCount}
    {#if filled}
      <!-- the cards are HTML built from escaped text (wordCardsHTML in src/lib/chapter/view.ts) -->
      <div class="words" role="group" aria-label={v.wordsLabel} {@attach wordColors}>
        {@html wordCardsHTML(wordsOf(v.vi), v.vi, chapter.lang)}
      </div>
    {:else}
      <div
        class="words"
        role="group"
        aria-label={v.wordsLabel}
        data-lazy="1"
        style:min-height="{Math.ceil(v.wordCount / 5) * 74}px"
        {@attach lazy}
      ></div>
    {/if}
  {/if}
  {#if v.note}<p class="vnote">{v.note}</p>{/if}
  <p class="blivre">
    <span class="tag">BLIVRE</span>{#each pieces as p, k (k)}{#if p.color}<mark class="mk mk-{p.color}">{p.text}</mark
        >{:else}{p.text}{/if}{/each}
  </p>
  <div class="vann" hidden={!strip}>
    {#if m?.favorite}<span class="vfav" title={t("verse.favorite")} aria-label={t("verse.favorite")}>★</span>{/if}{#if m?.firstNote}<button
        class="vann-note"
        data-ver={v.n}
        ><Icon name="note" /><span>{m.firstNote}</span>{#if m.moreNotes}<small>+{m.moreNotes}</small>{/if}</button
      >{/if}{#if m?.tags.length}<span class="vann-tags"
        >{#each m.tags as tag (tag)}<span class="chip">#{tag}</span>{/each}</span
      >{/if}
  </div>
  {#if v.marks.length}
    <details class="marks">
      <summary>⚑ {t("verse.review_points", { count: v.marks.length })}</summary>
      <ul>
        {#each v.marks as m, k (k)}
          <li>
            <span
              >{#if m.word}<span class="mk-w" lang={chapter.lang}>{m.word}</span>:
              {/if}{m.text}</span
            ><span class="mk-c">{t("verse.technical", { code: m.code })}</span>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</section>
