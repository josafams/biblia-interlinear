<!--
  The reading plan in Meu progresso (in ProgressSheet): with a plan, the day, the status and today's chapters;
  without one, the plans to start.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { progressView as p } from "../state/progress.svelte";

  let {
    ongo,
    onplan,
    onreschedule,
    onfinish
  }: {
    ongo: (code: string, chapter: number) => void;
    onplan: (id: "ano" | "nt90") => void;
    onreschedule: () => void;
    onfinish: () => void;
  } = $props();
</script>

<section class="pg-sec" aria-labelledby="pg-plan">
  {#if p.plan}
    {@const s = p.plan}
    <h3 id="pg-plan">{t("progress.plan_of", { plan: s.name })}</h3>
    <p class="pg-sub">
      {t("progress.plan_day", { day: s.dia, days: s.D, done: s.doneText, total: s.totalText })} ·
      <span class="pg-status {s.tipo}">{s.texto}</span>
    </p>
    {#if s.done < s.N}
      <p class="pg-sub">{t("progress.today")}</p>
      <div class="pg-day">
        {#each s.today as c (c.id)}
          <button data-ir={c.id} class={c.read ? "feito" : ""} onclick={() => ongo(c.id.split(".")[0], +c.id.split(".")[1])}
            >{c.label}</button
          >
        {:else}
          <span class="pg-sub">{t("progress.nothing_today")}</span>
        {/each}
      </div>
    {/if}
    <div class="pg-btns">
      <button id="pg-readjust" onclick={onreschedule}>{t("progress.reschedule")}</button><button id="pg-finish" onclick={onfinish}
        >{t("progress.finish_plan")}</button
      >
    </div>
  {:else}
    <h3 id="pg-plan">{t("progress.plan_title")}</h3>
    <p class="pg-sub">{t("progress.plan_pitch")}</p>
    <div class="pg-btns">
      <button data-plano="ano" onclick={() => onplan("ano")}>{t("progress.plans.ano")}</button><button
        data-plano="nt90"
        onclick={() => onplan("nt90")}>{t("progress.plans.nt90")}</button
      >
    </div>
  {/if}
</section>
