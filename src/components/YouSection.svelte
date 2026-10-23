<!--
  The Você part of the index (#toc-voce): the account, "Meu progresso", the reading plans (they need the
  account) and the links to the site.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { accountView } from "../state/account.svelte";
  import AccountBox from "./AccountBox.svelte";

  /** site: in the app, the address of the published site (its pages open in the device browser) */
  let { onprogress, onplan, site = "" }: { onprogress: () => void; onplan: () => void; site?: string } = $props();
  const signedIn = $derived(!["signed-out", "unavailable"].includes(accountView.status));
  const PLANS = [
    ["ano", "you.plan_year"],
    ["nt90", "you.plan_nt90"]
  ] as const;
  const LINKS = [
    ["index.html#como-usar", "you.how_to"], // i18n-ignore
    ["index.html", "you.about_project"],
    ["privacidade.html", "you.privacy"]
  ] as const;
</script>

<section class="sgroup" aria-labelledby="toc-yh" id="toc-voce">
  <h3 id="toc-yh" class="sr">{t("notes.you")}</h3>
  <div id="toc-account"><AccountBox /></div>
  <button type="button" class="vc-card" id="open-progress" onclick={onprogress}>
    <b>{t("you.progress_title")}</b><span id="vc-prog">{t(signedIn ? "you.progress" : "you.progress_signed_out")}</span>
  </button>
  <div class="vc-card vc-plans" role="group" aria-labelledby="vc-plans-h">
    <b id="vc-plans-h">{t("you.plans")}</b>
    {#each PLANS as [id, label] (id)}
      <button type="button" data-vc-plano={id} onclick={onplan}>{t(label)}<span aria-hidden="true">›</span></button>
    {/each}
  </div>
  <p class="vc-links">
    {#each LINKS as [href, label], i (href)}{#if i}
        ·
      {/if}<a href={site + href} class="site-link" target={site ? "_blank" : undefined} rel={site ? "noopener" : undefined}>{t(label)}</a
      >{/each}
  </p>
</section>
