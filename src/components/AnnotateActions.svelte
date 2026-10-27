<!--
  The top of Anotar: the highlight colors and the row of actions. On phones the compact sheet shows only this; "Nota"
  and "Mais" open the rest (AnnotateMore), and Copiar and Interlinear move to a second row of the full sheet
  (annotate.css). On computers "Nota" and "Mais" do not show: everything is already in the panel.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { COLOR_IDS, type AnnotateAction as Action, annotate } from "../state/annotate.svelte";

  let { oncolor, onaction }: { oncolor: (color: string) => void; onaction: (action: Action, button: HTMLButtonElement) => void } = $props();
</script>

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
  <button class="mb-color mb-none" data-cor="" aria-label={t("annotate.no_color")} onclick={() => oncolor("")}
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
  <button data-action="escrever" onclick={e => onaction("escrever", e.currentTarget)}
    ><svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M5 19h4L19 9l-4-4L5 15z" /><path d="M13.5 6.5l4 4" /></svg
    ><span>{t("annotate.note")}</span></button
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
  <button
    data-action="mais"
    aria-expanded={annotate.size === "full"}
    aria-controls="mb-more"
    onclick={e => onaction("mais", e.currentTarget)}
    ><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"
      ><circle cx="6" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18" cy="12" r="1.7" /></svg
    ><span>{t(annotate.size === "full" ? "annotate.less" : "annotate.more")}</span></button
  >
  <button data-action="camadas" hidden={!annotate.showLayers} onclick={e => onaction("camadas", e.currentTarget)}
    ><span class="mb-ab" aria-hidden="true">αβ</span><span>{t("annotate.layers")}</span></button
  >
</div>
