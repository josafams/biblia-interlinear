<!-- Top of the chapter: what text is on screen, "João 3" with the book name in the original, the theme. -->
<script lang="ts">
  import { t } from "../i18n";
  import { reader } from "../state/reader.svelte";

  const h = $derived(reader.heading);
</script>

<div class="eyebrow" id="eyebrow">{h ? reader.eyebrow : t("app.name")}</div>
<h1 id="h1">
  {#if h}{h.book}
    {h.chapter}{#if h.titleOrig}
      <span class="orig" lang={reader.greek ? "grc" : "he"}>{h.titleOrig}</span>{/if}{:else}{t("app.name")}{/if}
</h1>
<p class="ctheme" id="ctheme">{h?.theme ?? ""}</p>
<p class="lede sr" id="lede">{h ? t(reader.greek ? "reader.lede_greek" : "reader.lede_hebrew") : ""}</p>
