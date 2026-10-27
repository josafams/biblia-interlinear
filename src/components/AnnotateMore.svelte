<!--
  The rest of Anotar (#mb-more): the quick note (saved by itself), the verse's tags, its points of the automatic
  review and "Apagar tudo". On phones it shows in the full sheet; on computers always.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { tagKey } from "../lib/annotations/verse";
  import { type AnnotateAction as Action, annotate } from "../state/annotate.svelte";
  import { chapter } from "../state/chapter.svelte";

  let {
    onaction,
    ontag,
    onnewtag,
    onnote
  }: {
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
</script>

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

<div class="mb-more" id="mb-more">
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
        enterkeyhint="done"
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
