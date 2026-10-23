<!--
  "Como usar" on the home page: the tabs of video groups, the player with the written steps (the step being
  shown lights up) and the list of videos of the group. #v-<id> in the address opens that video.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { t } from "../i18n";
  import { recording, type Storyboard, type Storyboards } from "./data";

  let { storyboards }: { storyboards: Storyboards } = $props();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches; // i18n-ignore
  const phone = matchMedia("(max-width: 700px)").matches; // i18n-ignore
  const groups = $derived(storyboards.grupos.filter(g => storyboards.videos.some(v => v.grupo === g.id)));
  // the first group until the person picks another (or the address names a video)
  let group = $state(untrack(() => storyboards.grupos[0].id));
  let current = $state<Storyboard | null>(null);
  let time = $state(0);
  let player: HTMLElement | undefined = $state();
  const shown = $derived(storyboards.videos.filter(v => v.grupo === group));
  const rec = $derived(current ? recording(current.id, phone) : null);
  const step = $derived((rec?.times || []).reduce((i, s, k) => (time >= s ? k : i), -1));

  function pickGroup(id: string, choose = true) {
    group = id;
    if (choose && shown.length) show(shown[0]);
  }
  function show(v: Storyboard, scroll = false) {
    current = v;
    time = 0;
    if (scroll) player?.scrollIntoView({ block: "start" });
  }
  function fromHash() {
    const m = /^#v-(\w+)$/.exec(location.hash);
    const v = m && storyboards.videos.find(x => x.id === m[1]);
    if (!v) return false;
    pickGroup(v.grupo, false);
    show(v, true);
    return true;
  }
  onMount(() => {
    if (!fromHash()) pickGroup(group);
  });
  // plays while on the screen, pauses when it scrolls away
  function autoplay(video: HTMLVideoElement) {
    video.muted = true;
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? video.play().catch(() => {}) : video.pause())), {
      threshold: 0.5
    });
    io.observe(video);
    return () => io.disconnect();
  }
</script>

<svelte:window onhashchange={fromHash} />

<div class="tabs" role="tablist" aria-label={t("home.howto.groups")} id="howto-tabs">
  {#each groups as g (g.id)}<button
      class="tab"
      role="tab"
      type="button"
      data-g={g.id}
      aria-selected={g.id === group}
      onclick={() => pickGroup(g.id)}>{g.nome}<small>{storyboards.videos.filter(v => v.grupo === g.id).length}</small></button
    >{/each}
</div>
<div class="player" id="howto-player" bind:this={player}>
  <div class="tela" id="howto-screen">
    {#if current}
      {#key current.id}
        {#if rec && !reducedMotion}
          <!-- the captions are the steps on the side; the track is the same text -->
          <video
            controls
            muted
            playsinline
            loop
            preload="metadata"
            poster={rec.cover || ""}
            aria-label={current.titulo}
            bind:currentTime={time}
            {@attach autoplay}
          >
            {#if rec.webm}<source src={rec.webm} type="video/webm" />{/if}
            {#if rec.mp4}<source src={rec.mp4} type="video/mp4" />{/if}
            {#if rec.vtt}<track kind="captions" srclang="pt" label={t("home.howto.captions")} src={rec.vtt} default />{/if}
          </video>
        {:else if rec?.cover}
          <img src={rec.cover} alt={current.titulo} style="width:100%;border-radius:12px" />
        {:else}
          <div class="sem">{t(current.ready === false ? "home.howto.not_yet" : "home.howto.preparing")}</div>
        {/if}
      {/key}
    {/if}
  </div>
  <div class="passos">
    <span class="kick" id="howto-num" style="font-size: 12px"
      >{#if current}{t("home.howto.number", {
          n: current.n,
          group: storyboards.grupos.find(g => g.id === current!.grupo)?.nome || ""
        })}{/if}</span
    >
    <h3 id="howto-title">{current?.titulo || ""}</h3>
    <ol id="howto-steps">
      {#each current?.steps || [] as s, k (k)}<li class={k === step ? "on" : ""}>{s}</li>{/each}
    </ol>
  </div>
</div>
<div class="vids" id="howto-list">
  {#each shown as v (v.id)}
    {@const r = recording(v.id, phone)}
    <button class="vid" type="button" data-id={v.id} id="v-{v.id}" aria-current={current?.id === v.id} onclick={() => show(v, true)}>
      <span class="capa"
        >{#if r?.cover}<img src={r.cover} alt="" loading="lazy" />{:else}<span class="n">{v.n}</span>{/if}{#if r?.duration}<span class="dur"
            >{r.duration}</span
          >{/if}{#if v.ready === false}<span class="badge soon">{t("home.howto.soon")}</span>{/if}</span
      ><b>{v.n}. {v.titulo}</b><span class="d">{v.desc}</span>
    </button>
  {/each}
</div>
