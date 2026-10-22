<!--
  One verse: number, the ⋯ button (annotate, listen), the word cards, the Bíblia Livre text and the points of the
  automatic review. .vtags, .vann and the highlight classes are filled in by web/annotations.js.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { type VerseView, wordCardsHTML } from "../lib/chapter/view";
  import { chapter, fillWhenNear, wordsOf } from "../state/chapter.svelte";

  let { v }: { v: VerseView } = $props();
  const filled = $derived(chapter.filled[v.vi]);
  const [cap, num] = $derived(v.label.includes(":") ? v.label.split(":") : [null, v.label]);

  function lazy(el: HTMLElement) {
    if (chapter.filled[v.vi]) return;
    return fillWhenNear(el, v.vi);
  }
</script>

<section class="verse" id="v{v.n}" data-vi={v.vi} aria-labelledby="vh{v.n}">
  <div class="vhead">
    <h3 class="vnum" class:has-rev={v.hasMarks} id="vh{v.n}">
      <span class="sr">{t("verse.sr")}</span>{#if cap}<span class="vcap">{cap}:</span>{num}{:else}{v.label}{/if}{#if v.hasMarks}<span
          class="sr">{t("verse.review_sr")}</span
        >{/if}
    </h3>
    <span class="vtags"></span>
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
      <div class="words" role="group" aria-label={v.wordsLabel}>{@html wordCardsHTML(wordsOf(v.vi), v.vi, chapter.lang)}</div>
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
  <p class="blivre"><span class="tag">BLIVRE</span>{v.blivre}</p>
  <div class="vann" hidden></div>
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
