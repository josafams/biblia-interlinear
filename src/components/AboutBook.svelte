<!--
  "Sobre o livro" (details#sobre, under the chapter title): summary, facts, how the book is divided, people,
  when it was written, a timeline of what it tells, historical context, themes and key verses. Chapter
  references open the index on that chapter. Open or closed stays as the person left it.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { timeline } from "../lib/about";
  import { store } from "../lib/store";
  import { reader } from "../state/reader.svelte";
  import AboutTimeline from "./AboutTimeline.svelte";

  let { onchapter }: { onchapter: (ch: number) => void } = $props();
  const about = $derived(reader.about);
  const A = $derived(about.data);
  const E = $derived(A?.events);
  const tl = $derived(E?.timeline?.length ? timeline(E) : null);
  const ref = (from: number, to?: number) => (to && to !== from ? t("about.chapters", { from, to }) : t("about.chapter", { n: from }));
  const refLabel = (from: number, to?: number) =>
    to && to !== from ? t("about.see_chapters", { from, to }) : t("about.see_chapter", { n: from });
</script>

{#snippet chref(from: number, to?: number)}
  <button class="chref" data-ch={from} aria-label={refLabel(from, to)} onclick={() => onchapter(from)}>{ref(from, to)}</button>
{/snippet}

<details
  class="about"
  id="sobre"
  data-testid="about-book"
  hidden={!A}
  bind:open={reader.aboutOpen}
  ontoggle={() => store.set("sobre-aberto", reader.aboutOpen ? "on" : "off")}
>
  <summary
    ><span class="ab-k">{t("header.about")}</span><span class="ab-t" id="ab-title"
      >{about.book}{#if A?.title_orig}<span class="orig" lang={about.greek ? "grc" : "he"}>{A.title_orig}</span>{/if}</span
    ><span class="ab-s">{t("about.subtitle")}</span><svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg
    ></summary
  >
  <div class="ab-body" id="about-body">
    {#if A}
      <p class="ab-lead">{A.summary}</p>
      <dl class="ab-facts">
        {#each A.facts || [] as [k, v], i (i)}<div>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>{/each}
      </dl>
      {#if A.name}<section class="ab-sec">
          <h3>{t("about.the_name")}</h3>
          <p>{A.name}</p>
        </section>{/if}
      {#if A.structure?.length}
        <section class="ab-sec">
          <h3>{t("about.structure")}</h3>
          <div class="ab-grid four">
            {#each A.structure as p, i (i)}
              <div class="ab-card">
                <h4>{p.title}</h4>
                <p>{p.text}</p>
                {#if p.from}{@render chref(p.from, p.to)}{/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}
      {#if A.extra}<section class="ab-sec">
          <h3>{A.extra.title}</h3>
          <p>{A.extra.text}</p>
        </section>{/if}
      {#if A.people?.length}
        <section class="ab-sec">
          <h3>{t("about.people")}</h3>
          <ul class="ab-people">
            {#each A.people as p, i (i)}
              <li>
                <span class="pn">{p.name}</span>
                {#if p.ch}<button
                    class="chref"
                    data-ch={p.ch}
                    aria-label={t("about.person_chapter", { name: p.name, n: p.ch })}
                    onclick={() => onchapter(p.ch!)}
                    >{about.chapters > 1 ? t("about.caps_short") : t("about.verses_short")}{p.chapters || p.ch}</button
                  >{/if}
                <span class="pnote">{p.note}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
      {#if A.writing}
        <section class="ab-sec">
          <h3>{t("about.written")}</h3>
          <div class="ab-grid">
            <div class="ab-card">
              <h4>{t("about.tradition")}</h4>
              <p>{A.writing.tradition}</p>
            </div>
            <div class="ab-card alt">
              <h4>{t("about.academic")}</h4>
              <p>{A.writing.academic}</p>
            </div>
          </div>
        </section>
      {/if}
      {#if E}
        <section class="ab-sec">
          <h3>{t("about.when")}</h3>
          <p>{E.intro}</p>
          {#if tl}<AboutTimeline {tl} />{/if}
        </section>
      {/if}
      {#if A.context}
        <section class="ab-sec">
          <h3>{t("about.context")}</h3>
          <p>{A.context}</p>
          {#if A.places?.length}
            <div class="ab-chips" role="list" aria-label={t("about.places")}>
              {#each A.places as l, i (i)}<span role="listitem">{l}</span>{/each}
            </div>
          {/if}
        </section>
      {/if}
      {#if A.themes?.length}
        <section class="ab-sec">
          <h3>{t("about.themes")}</h3>
          <div class="ab-chips" role="list">
            {#each A.themes as l, i (i)}<span role="listitem">{l}</span>{/each}
          </div>
        </section>
      {/if}
      {#if A.key_verses?.length}
        <section class="ab-sec">
          <h3>{t("about.key_verses")}</h3>
          {#each A.key_verses as k, i (i)}<blockquote class="ab-quote">
              <p>{k.text}</p>
              <cite>{about.book} {k.ref} · BLIVRE</cite>
            </blockquote>{/each}
        </section>
      {/if}
      {#if A.note}<p class="ab-note">{A.note}</p>{/if}
      <p class="ab-note">{t("about.disclaimer")}</p>
    {/if}
  </div>
</details>
