<!-- The title in the top bar: "João 3" and the chapter theme. It opens the index on the chapters of the book. -->
<script lang="ts">
  import { t } from "../i18n";
  import { reader } from "../state/reader.svelte";

  let { onopen }: { onopen: () => void } = $props();
  const here = $derived(reader.here);
  const label = $derived.by(() => {
    if (!here) return undefined;
    const ref = here.verse === 0 ? t("bar.where_title_ref", { ch: here.chapter }) : `${here.chapter}:${here.verse}`;
    return t(here.theme ? "bar.where_label_theme" : "bar.where_label", { book: here.book, ref, theme: here.theme });
  });
</script>

<button
  type="button"
  class="where"
  id="where"
  data-testid="where"
  aria-haspopup="dialog"
  aria-controls="toc"
  aria-label={label}
  onclick={onopen}
>
  <span id="where-t">
    {#if here}<b>{here.book} {here.chapter}</b>{#if here.theme}<span class="wt-sub">{here.theme}</span>{/if}{:else}<b>{t("app.name")}</b
      >{/if}
  </span>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg
  >
</button>
