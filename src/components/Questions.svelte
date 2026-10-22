<!--
  "Perguntas ao texto" at the end of the chapter (data/questions): questions without answers, to think about
  or talk over. Each one can jump to its verse, open its word in the lexicon and start a note for the answer.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { reader, type Question } from "../state/reader.svelte";

  let {
    ongoverse,
    onword,
    onnote
  }: {
    ongoverse: (verse: number) => void;
    onword: (strong: string, button: HTMLButtonElement) => void;
    onnote: (question: Question) => void;
  } = $props();

  const range = (q: Question) => {
    const [a, b] = (q.verses || "").split("-").map(Number);
    return { first: a || 0, label: a ? (b ? `v. ${a}–${b}` : `v. ${a}`) : "" };
  };
</script>

{#if reader.questions.length}
  <section class="qsec" id="perguntas" data-testid="questions" aria-labelledby="q-h">
    <h2 id="q-h">{t("questions.title")}</h2>
    <p class="lede">{t("questions.lede")}</p>
    <ol class="qlist">
      {#each reader.questions as q, i (i)}
        {@const r = range(q)}
        <li class="q q-{q.kind}">
          <span class="q-k">{t(`questions.kind.${q.kind}`)}</span>
          <p class="q-t">{q.text}</p>
          <div class="q-acts">
            {#if r.first}
              <button
                type="button"
                class="q-ref"
                data-v={r.first}
                aria-label={t("questions.go_verse", { v: r.first })}
                onclick={() => ongoverse(r.first)}>{r.label}</button
              >
            {/if}
            {#if q.strong}
              <button
                type="button"
                class="q-word"
                data-strong={q.strong}
                aria-label={t("questions.open_word", { strong: q.strong })}
                onclick={e => onword(q.strong!, e.currentTarget)}
                >{#if q.lemma}<span lang={reader.greek ? "grc" : "he"}>{q.lemma}</span>
                {/if}{q.strong}</button
              >
            {/if}
            <button type="button" class="q-note" data-q={i} onclick={() => onnote(q)}>{t("questions.note")}</button>
          </div>
        </li>
      {/each}
    </ol>
  </section>
{/if}
