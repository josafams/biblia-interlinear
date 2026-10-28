<!--
  Aparência (#look): reading mode, "O que mostrar", text (size, easy font, spacing, cantillation, hiding the
  bars), color theme and audio. The sheet on phones, the side panel on computers. Every switch keeps its id
  (#t-xlit…) for the tests and the "Como usar" videos.
-->
<script lang="ts">
  import { getLocale, t } from "../i18n";
  import { type PrefDef, PREFS, SIZES, THEMES, type ThemeId } from "../lib/prefs";
  import type { ModeId } from "../lib/modes";
  import { prefs, setSize, setTheme } from "../state/prefs.svelte";
  import { speech } from "../state/speech.svelte";
  import LanguagePicker from "./LanguagePicker.svelte";
  import ModeNote from "./ModeNote.svelte";
  import ModeSelector from "./ModeSelector.svelte";
  import SwitchChip from "./SwitchChip.svelte";

  let {
    onmode,
    ontoggle,
    oninstallvoices,
    onsources
  }: {
    onmode: (id: ModeId) => void;
    ontoggle: (def: PrefDef) => void;
    oninstallvoices: () => void;
    onsources: () => void;
  } = $props();
  const group = (g: PrefDef["group"]) => PREFS.filter(p => p.group === g);
  const pick = (id: ThemeId) => setTheme(id);
</script>

{#snippet close()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"
    ><path d="M6 6l12 12M18 6L6 18" /></svg
  >
{/snippet}

<!-- the same aside[role=dialog] as the other sheets (the styles and the tests expect it) -->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  class="sheet right"
  id="look"
  data-testid="appearance"
  role="dialog"
  aria-modal="true"
  aria-labelledby="look-h"
  lang={getLocale()}
  hidden
>
  <div class="shead">
    <h2 id="look-h">{t("bar.look")}</h2>
    <button class="ibtn" data-close aria-label={t("look.close")}>{@render close()}</button>
  </div>
  <div class="sgroup" role="group" aria-labelledby="g-mode">
    <h3 id="g-mode">{t("look.mode")}</h3>
    <div class="mode-grid" id="mode-grid" role="radiogroup" aria-labelledby="g-mode"><ModeSelector variant="card" onselect={onmode} /></div>
    <p class="mode-note" id="mode-note"><ModeNote /></p>
  </div>
  <div class="sgroup" role="group" aria-labelledby="g-what">
    <h3 id="g-what">{t("look.show")}</h3>
    <div class="chks chips" id="g-show">
      {#each group("show") as def (def.id)}<SwitchChip {def} {ontoggle} />{/each}
    </div>
  </div>
  <div class="sgroup" role="group" aria-labelledby="g-size">
    <h3 id="g-size">{t("look.text")}</h3>
    <div class="sizer">
      <button
        class="step sm"
        id="size-down"
        aria-label={t("look.smaller")}
        disabled={prefs.size === 0}
        onclick={() => setSize(prefs.size - 1)}>A−</button
      >
      <output id="size-out" aria-live="polite">{Math.round(SIZES[prefs.size] * 100)}%</output>
      <button
        class="step lg"
        id="size-up"
        aria-label={t("look.larger")}
        disabled={prefs.size === SIZES.length - 1}
        onclick={() => setSize(prefs.size + 1)}>A+</button
      >
    </div>
    <div class="chks chips">
      {#each group("text") as def (def.id)}<SwitchChip {def} {ontoggle} />{/each}
    </div>
  </div>
  <div class="sgroup" role="group" aria-labelledby="g-theme">
    <h3 id="g-theme">{t("look.theme")}</h3>
    <div class="tgrid" id="tgrid">
      <button class="tcard tauto" data-p="auto" aria-pressed={prefs.theme === "auto"} onclick={() => pick("auto")}
        ><span class="half" aria-hidden="true"></span><span>{t("look.themes.auto")}<small>{t("look.themes.auto_hint")}</small></span
        ></button
      >
      {#each THEMES as th (th.id)}
        <button
          class="tcard"
          data-p={th.id}
          aria-pressed={prefs.theme === th.id}
          aria-label={t(th.dark ? "look.theme_dark" : "look.theme_light", { theme: t(`look.themes.${th.id}`) })}
          style:--pb={th.bg}
          style:--pf={th.fg}
          style:--pa={th.ac}
          onclick={() => pick(th.id)}
        >
          <span class="tprev" aria-hidden="true"
            ><span class="ph" lang="he">אוֹר</span><span class="px">ʼôwr</span><span class="pg">{t("look.preview_gloss")}</span></span
          ><span aria-hidden="true">{t(`look.themes.${th.id}`)}</span>
        </button>
      {/each}
    </div>
  </div>
  <div class="sgroup" role="group" aria-labelledby="g-audio">
    <h3 id="g-audio">{t("look.audio")}</h3>
    <p class="vnote" id="voice-note">{speech.voiceNote || t("look.searching_voices")}</p>
    <div class="chks chips">
      <button class="chk" id="voice-install" hidden={!speech.canInstallVoices} onclick={oninstallvoices}
        ><span>{t("look.install_voices")}<small>{t("look.install_voices_hint")}</small></span></button
      >
      {#each group("audio") as def (def.id)}<SwitchChip {def} {ontoggle} />{/each}
    </div>
  </div>
  <LanguagePicker />
  <p class="look-foot">
    <a
      href="#fontes"
      id="look-sources"
      onclick={e => {
        e.preventDefault();
        onsources();
      }}>{t("look.sources")}</a
    >
  </p>
</aside>
