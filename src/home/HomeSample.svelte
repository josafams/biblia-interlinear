<!-- The hero sample (figure.sample): Genesis 1:1 in Hebrew and the start of John 1:1 in Greek, as word cards. -->
<script lang="ts">
  import { t } from "../i18n";
  import type { SampleVerse } from "./data";

  let { verses }: { verses: SampleVerse[] } = $props();
</script>

{#each verses as v, i (v.ref)}
  {#if i}<div class="sep"></div>{/if}
  <div class="ref"><b>{v.ref}</b><span>{t(v.greek ? "home.sample_greek" : "home.sample_hebrew")}</span></div>
  <div class="cards" class:rtl={!v.greek}>
    {#each v.words as w, k (k)}<div class="wc">
        <span class="o" class:g={v.greek} lang={v.greek ? "grc" : "he"}>{w.o}</span><span class="x">{w.x}</span><span class="s">{w.s}</span
        ><span class="t">{w.t}</span>
      </div>{/each}
  </div>
  <p class="blivre"><small>BLIVRE</small>{v.blivre}</p>
{/each}

<style>
  .sep {
    height: 1px;
    background: var(--line);
  }
</style>
