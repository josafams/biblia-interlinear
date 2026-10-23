<!--
  A note in full screen (#nota): title, text (both saved by themselves a moment after typing), tags and delete
  (pressed twice). src/reader/annotations/note.ts keeps the record and does the saving through the props.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { note } from "../state/note.svelte";

  let {
    onclose,
    oninput,
    ontag,
    onnewtag,
    ondelete
  }: {
    onclose: () => void;
    oninput: () => void;
    ontag: (id: string) => void;
    onnewtag: (name: string) => void;
    ondelete: () => void;
  } = $props();

  let tagName = $state("");
  let tagInput: HTMLInputElement | undefined = $state();
  function newTag() {
    if (!tagName.trim()) return tagInput?.focus();
    onnewtag(tagName.trim());
    tagName = "";
  }
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
  id="nota"
  class="sheet right note-sheet"
  data-testid="note-editor"
  hidden={!note.open}
  role="dialog"
  aria-modal="true"
  aria-labelledby="note-h"
  tabindex="-1"
  onkeydown={keydown}
>
  <div class="shead">
    <h2 id="note-h">{t("note.title")}</h2>
    <button class="ibtn" data-fechar aria-label={t("note.close")} onclick={onclose}
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
  </div>
  <div class="sgroup note-body">
    <p class="note-ref" id="note-ref">{note.ref}</p>
    <label class="sr" for="note-title">{t("note.title_label")}</label>
    <input id="note-title" type="text" placeholder={t("note.title_placeholder")} autocomplete="off" bind:value={note.title} {oninput} />
    <label class="sr" for="note-text">{t("note.text_label")}</label>
    <textarea id="note-text" rows="10" placeholder={t("note.text_placeholder")} bind:value={note.text} {oninput}></textarea>
    <div class="note-tags" id="note-tags">
      <span class="note-tags-r">{t("note.tags")}</span>{#each note.tags as tag (tag.id)}<button
          class="chip"
          data-tag={tag.id}
          aria-pressed={note.selected.includes(tag.id)}
          onclick={() => ontag(tag.id)}>{tag.nome}</button
        >{/each}<span class="note-tag-new"
        ><label class="sr" for="note-tag-name">{t("note.new_tag")}</label><input
          id="note-tag-name"
          type="text"
          placeholder={t("note.new_tag_placeholder")}
          autocomplete="off"
          bind:value={tagName}
          bind:this={tagInput}
          onkeydown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              newTag();
            }
          }}
        /><button class="chip" data-et-nova onclick={newTag}>{t("annotate.create_tag")}</button></span
      >
    </div>
    <div class="note-footer">
      <span id="note-status" aria-live="polite">{note.status}</span><button
        class="note-delete"
        id="note-delete"
        hidden={!note.saved}
        onclick={ondelete}>{t(note.confirming ? "note.delete_confirm" : "note.delete")}</button
      >
    </div>
  </div>
</aside>
