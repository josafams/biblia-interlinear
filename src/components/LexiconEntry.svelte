<!--
  The lexicon entry (verbete) inside #d-body: the word as in the text, ‹ › to the neighbouring words, the lemma
  with transliteration and pronunciation, the word in this verse, then meaning, translations, origin and the
  Strong number. Strong numbers in the origin open their own entries (with "← voltar").
-->
<script lang="ts">
  import { t, tryT } from "../i18n";
  import { pronunciationRules, stressedSyllables } from "../lib/pronunciation";
  import { esc } from "../lib/text";
  import { entry } from "../state/entry.svelte";

  let {
    onclose,
    onstep,
    onsay,
    onconcordance,
    onback,
    onref
  }: {
    onclose: () => void;
    onstep: (dir: -1 | 1) => void;
    onsay: (text: string, button: HTMLButtonElement) => void;
    onconcordance: (key: string) => void;
    onback: () => void;
    onref: (key: string) => void;
  } = $props();

  const e = $derived(entry.view);
  // reading order: Greek left to right, Hebrew right to left (the first button is "next" in Hebrew)
  const greek = $derived(e?.lang === "grc");
  const first = $derived<-1 | 1>(greek ? -1 : 1);
  const openRef = (ev: MouseEvent) => {
    const r = (ev.target as HTMLElement).closest<HTMLElement>(".ref");
    if (r?.dataset.ref) onref(r.dataset.ref);
  };
  // how to read this word's pronunciation: its stressed syllable and only the spellings it uses
  function pronLegend(pron: string) {
    const stressed = stressedSyllables(pron);
    const parts = [
      ...(stressed.length ? [t("entry.pron_stress", { stressed: esc(stressed.join(", ")) })] : []),
      ...pronunciationRules(pron).flatMap(r => tryT(`entry.pron_rule.${r}`) ?? [])
    ];
    return t("entry.pron_how", { pron: esc(pron) }) + (parts.length ? ": " + parts.join("; ") : "") + ".";
  }
</script>

{#snippet nav(dir: -1 | 1)}
  {#if e?.position}
    <button
      class="dnav"
      id={dir < 0 ? "d-prev" : "d-next"}
      aria-label={t(dir < 0 ? (greek ? "entry.prev_word" : "entry.prev_word_rtl") : greek ? "entry.next_word" : "entry.next_word_rtl")}
      disabled={!(dir < 0 ? entry.canPrev : entry.canNext)}
      onclick={() => onstep(dir)}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"><path d={dir < 0 === greek ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} /></svg
      >
    </button>
  {/if}
{/snippet}

{#snippet legend()}
  {#if e?.pron}
    <!-- the texts of the locale, with <b>; the pronunciation goes in escaped -->
    <p class="plegend">{@html pronLegend(e.pron)}</p>
  {/if}
{/snippet}

{#if e}
  <div class="dtop">
    {@render nav(first)}
    <div class="dtitle">
      <h2 class="dh" class:grc={greek} id="d-title" tabindex="-1" lang={e.lang}>{e.title}</h2>
      {#if e.position}<span class="dpos">{e.position}</span>{/if}
    </div>
    {@render nav(first === 1 ? -1 : 1)}
    <button class="dclose" id="d-close" aria-label={t("entry.close")} onclick={onclose}>✕</button>
  </div>
  <div class="dlem">
    <span class="dlem-t"
      ><span class="dl" class:grc={greek} lang={e.lang}>{e.lemma}</span>{#if e.xlit}
        · <em>{e.xlit}</em>{/if}{#if e.pron}
        · <span class="pron">{e.pron}</span>{/if}</span
    ><button class="say" data-say={e.say} onclick={ev => onsay(e.say, ev.currentTarget)}
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg
      ><span>{t("audio.listen")}</span></button
    >
  </div>
  {#if entry.canGoBack}<button class="dback" id="d-back" onclick={onback}>{t("entry.back")}</button>{/if}
  {#if e.context}
    <div class="dctx">
      <div class="dk">{t("entry.in_verse")}</div>
      <!-- glossHtml is built from escaped text (glossHTML in src/lib/text.ts) -->
      <div class="cg">
        {@html e.context.glossHtml} <span class="sr">({e.context.glossSpoken})</span>{#if e.context.source}<small class="gfn"
            >{e.context.source}</small
          >{/if}{#if e.context.objectNote}<small class="gfn">{t("entry.object_note")}</small>{/if}
      </div>
      <div class="dmeta">{e.context.morph}</div>
      {#if e.context.ketiv}<p class="kq">{@html t("entry.ketiv")} <span lang="he">{e.context.ketiv}</span></p>{/if}
    </div>
  {/if}
  {#if !e.found}
    <div class="dsec">
      <p>{t("entry.not_found")}</p>
      {@render legend()}
    </div>
  {:else}
    <div class="dsec dmean">
      <h3>{t("entry.meaning")}</h3>
      {#if e.meaning.english}<p class="en" lang="en">{e.meaning.text} <em lang="pt-BR">{t("entry.english_note")}</em></p>{:else}<p>
          {e.meaning.text}
        </p>{/if}
    </div>
    {#if e.translations.length}
      <div class="dsec">
        <h3>{t("entry.translations")}</h3>
        <div class="dtr">
          {#each e.translations as tr, k (k)}<span>{tr.text}<small>{tr.count}</small></span>{/each}
        </div>
        <p class="plegend">{t("entry.translations_note")}</p>
      </div>
    {/if}
    {#if e.occurrences}
      <button class="dconc" id="d-conc" data-key={e.key} onclick={() => onconcordance(e.key)}
        >{t("entry.concordance", { count: e.occurrences })}</button
      >
    {/if}
    {#if e.originHtml}
      <!-- the origin is escaped text with buttons for its Strong numbers (linkRefs in src/lib/lexicon/entry.ts);
           the click is heard here for those buttons, which are reachable by keyboard themselves -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="dsec" onclick={openRef}>
        <h3>{t("entry.origin")}</h3>
        {#if e.originEnglish}<p class="en" lang="en">{@html e.originHtml} <em lang="pt-BR">{t("entry.english_note")}</em></p>{:else}<p>
            {@html e.originHtml}
          </p>{/if}
      </div>
    {/if}
    <div class="dfoot">
      <span
        >{e.uses}{#if e.englishUrl}
          · <a href={e.englishUrl} target="_blank" rel="noopener">{t("entry.english_entry")}<span class="sr">{t("entry.new_tab")}</span></a
          >{/if}</span
      >
    </div>
    <div class="dsec">{@render legend()}</div>
  {/if}
{/if}
