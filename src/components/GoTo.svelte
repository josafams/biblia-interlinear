<!--
  "Ir para" (section#toc-livros): a reference or a book name. While typing, the preview says where it goes
  (or what is wrong); Enter or the button goes there. web/reader.js reads #go-in and does the going.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { goto } from "../state/goto.svelte";

  let { oninput, ongo }: { oninput: () => void; ongo: () => void } = $props();
  const p = $derived(goto.preview);
</script>

<h3 id="go-h"><label for="go-in">{t("goto.label")}</label></h3>
<form
  class="go-row"
  id="go-form"
  autocomplete="off"
  onsubmit={e => {
    e.preventDefault();
    ongo();
  }}
>
  <input
    id="go-in"
    type="text"
    enterkeyhint="go"
    placeholder={t("goto.placeholder")}
    spellcheck="false"
    aria-describedby="go-hint"
    {oninput}
  />
  <button type="submit" class="go-btn">{t("goto.go")}</button>
</form>
<!-- trusted text of the locale, with <b> examples -->
<p class="go-hint" id="go-hint">{@html t("goto.hint")}</p>
<div class="go-prev" id="go-prev" class:warn={p.kind === "warn" || p.kind === "na"} aria-live="polite" hidden={p.kind === "none"}>
  {#if p.kind === "warn"}
    <!-- the warning of src/lib/refs.ts: escaped text with <b> examples -->
    <p class="gp-note">{@html p.html}</p>
  {:else if p.kind === "na"}
    <div class="gp-ref">
      {p.ref}{#if p.theme}<span class="gp-ct"> · {p.theme}</span>{/if}
    </div>
    <p class="gp-note">{t("reader.not_in_preview")}</p>
  {:else if p.kind === "ok"}
    <div class="gp-ref">{p.ref}</div>
    {#if p.theme}<div class="gp-theme">{p.theme}</div>{/if}
    {#if p.snippet}<p class="gp-snip">{p.snippet}</p>{/if}
    <button type="button" class="gp-go" id="gp-go" onclick={ongo}>{t("goto.go_to", { ref: p.button })}</button>
  {/if}
</div>
