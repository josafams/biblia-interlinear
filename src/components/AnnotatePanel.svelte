<!--
  Anotar (#mbar): the sheet on phones, the side panel on computers. Highlight color, favorite, listen, copy,
  share, the quick note (saved by itself), the verse's tags and its points of the automatic review.
  web/annotations.js does the work through the props; ids, data-cor and data-action stay for tests and videos.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { tagKey } from "../lib/annotations/verse";
  import { COLOR_IDS, annotate } from "../state/annotate.svelte";
  import { chapter } from "../state/chapter.svelte";

  type Action = "fav" | "ouvir" | "copiar" | "compartilhar" | "camadas" | "nota" | "limpar";
  let {
    onclose,
    oncolor,
    onaction,
    ontag,
    onnewtag,
    onnote
  }: {
    onclose: () => void;
    oncolor: (color: string) => void;
    onaction: (action: Action, button: HTMLButtonElement) => void;
    ontag: (id: string) => void;
    onnewtag: (name: string) => void;
    onnote: (text: string) => void;
  } = $props();

  const SUGGESTED = t("annotate.suggestions").split("|");
  let tagName = $state("");
  let tagInput: HTMLInputElement | undefined = $state();
  const filter = $derived(tagKey(tagName));
  const shown = (name: string) => !filter || tagKey(name).includes(filter);
  const review = $derived(chapter.verses.find(v => v.n === annotate.verse)?.marks ?? []);

  function newTag(name: string) {
    if (!name.trim().replace(/^#+\s*/, "")) return tagInput?.focus();
    onnewtag(name);
    tagName = "";
  }
  function keydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }
</script>

{#snippet hide()}
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
  >
{/snippet}
{#snippet chip(tag: { id: string; nome: string }, on: boolean)}
  <button
    class="chip"
    data-etiqueta={tag.id}
    aria-pressed={on}
    aria-label={on ? t("annotate.untag", { tag: tag.nome }) : undefined}
    hidden={!shown(tag.nome)}
    onclick={() => {
      ontag(tag.id);
      tagName = "";
    }}>{tag.nome}</button
  >
{/snippet}

<div
  id="mbar"
  class="mbar"
  data-testid="annotate-panel"
  hidden={!annotate.open}
  role="dialog"
  aria-label={t("annotate.label")}
  tabindex="-1"
  onkeydown={keydown}
>
  <div class="mb-top">
    <div class="mb-head"><b id="mb-ref">{annotate.ref}</b><span id="mb-snippet">{annotate.snippet}</span></div>
    <button class="mb-x" id="mb-close" aria-label={t("annotate.close")} onclick={onclose}>{@render hide()}</button>
  </div>
  <div class="mb-body">
    <div class="mb-colors" role="group" aria-label={t("annotate.colors")}>
      {#each COLOR_IDS as c (c)}
        <button
          class="mb-color mk-{c}"
          data-cor={c}
          aria-pressed={annotate.color === c}
          aria-label={t(`annotate.color.${c}`)}
          onclick={() => oncolor(c)}
        ></button>
      {/each}
      <button class="mb-color mb-none" data-cor="" aria-label={t("annotate.no_color")} onclick={() => oncolor("")}>{@render hide()}</button>
    </div>
    <div class="mb-actions">
      <button data-action="fav" aria-pressed={annotate.favorite} onclick={e => onaction("fav", e.currentTarget)}
        ><svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
          aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg
        ><span>{t(annotate.favorite ? "annotate.favorite_on" : "annotate.favorite")}</span></button
      >
      <button data-action="ouvir" onclick={e => onaction("ouvir", e.currentTarget)}
        ><svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg
        ><span>{t("audio.listen")}</span></button
      >
      <button data-action="copiar" onclick={e => onaction("copiar", e.currentTarget)}
        ><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"
          ><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg
        ><span>{t("annotate.copy")}</span></button
      >
      <button data-action="compartilhar" onclick={e => onaction("compartilhar", e.currentTarget)}
        ><svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></svg
        ><span>{t("annotate.share")}</span></button
      >
      <button data-action="camadas" hidden={!annotate.showLayers} onclick={e => onaction("camadas", e.currentTarget)}
        ><span class="mb-ab" aria-hidden="true">αβ</span><span>{t("annotate.layers")}</span></button
      >
    </div>
    <div class="mb-note">
      <div class="mb-lbl">
        <label for="mb-note">{t("annotate.note")}</label><span id="mb-note-status" aria-live="polite">{annotate.noteStatus}</span>
      </div>
      <textarea
        id="mb-note"
        rows="4"
        placeholder={t(annotate.question ? "annotate.answer_placeholder" : "annotate.note_placeholder")}
        bind:value={annotate.note}
        oninput={() => onnote(annotate.note)}
      ></textarea>
      <div class="mb-note-foot">
        <button class="linklike" data-action="nota" onclick={e => onaction("nota", e.currentTarget)}>{t("annotate.full_screen")}</button>
      </div>
    </div>
    <div class="mb-tags" id="mb-tags" role="group" aria-label={t("annotate.tags")}>
      <div class="mb-lbl">{t("annotate.tags")}</div>
      {#if annotate.tags.mine.length}
        <div class="mb-tag-list mb-mine">
          {#each annotate.tags.mine as tag (tag.id)}{@render chip(tag, true)}{/each}
        </div>
      {/if}
      <span class="mb-tag-new"
        ><label class="sr" for="mb-tag-name">{t("annotate.add_tag")}</label><input
          id="mb-tag-name"
          type="text"
          placeholder={t("annotate.add_tag_placeholder")}
          autocomplete="off"
          bind:value={tagName}
          bind:this={tagInput}
          onkeydown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              newTag(tagName);
            }
          }}
        /><button id="mb-new-tag" class="chip" onclick={() => newTag(tagName)}>{t("annotate.create_tag")}</button></span
      >
      {#if annotate.tags.any ? annotate.tags.rest.length : true}
        <span class="mb-sug-lbl">{t(annotate.tags.any ? "annotate.your_tags" : "annotate.suggested_tags")}</span>
        <div class="mb-tag-list">
          {#if annotate.tags.any}
            {#each annotate.tags.rest as tag (tag.id)}{@render chip(tag, false)}{/each}
          {:else}
            {#each SUGGESTED as s (s)}<button class="chip mb-sug" data-sug={s} onclick={() => newTag(s)}>{s}</button>{/each}
          {/if}
        </div>
      {/if}
    </div>
    <div class="mb-review" id="mb-review" hidden={!review.length}>
      <b>{t("annotate.review")}</b>
      <ul id="mb-review-list">
        {#each review as m, k (k)}
          <li>
            <span
              >{#if m.word}<span class="mk-w" lang={chapter.lang}>{m.word}</span>:
              {/if}{m.text}</span
            ><span class="mk-c">{t("verse.technical", { code: m.code })}</span>
          </li>
        {/each}
      </ul>
    </div>
    <button class="linklike mb-del" data-action="limpar" hidden={!annotate.hasRecords} onclick={e => onaction("limpar", e.currentTarget)}
      >{t("annotate.clear")}</button
    >
  </div>
  <div class="mb-foot"><button class="mb-done" id="mb-done" onclick={onclose}>{t("annotate.done")}</button></div>
</div>
