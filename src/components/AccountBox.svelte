<!--
  The account in the "Você" tab (#conta): "Entrar com Google" when signed out; the person, Drive and sync status
  when connected; "Reconectar" when the connection expired. The buttons are handled by src/reader/account.ts (ids).
-->
<script lang="ts">
  import { t } from "../i18n";
  import { accountView as a } from "../state/account.svelte";
  import GoogleIcon from "./GoogleIcon.svelte";

  const initials = (n: string | undefined) =>
    (n || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join("");
  const signedOut = $derived(a.status === "signed-out" || (a.status === "connecting" && !a.me));
</script>

{#snippet me()}
  {#if a.me}
    <div class="account-me">
      <div class="account-photo">
        {#if a.me.photo}<img src={a.me.photo} alt="" referrerpolicy="no-referrer" />{:else}{initials(a.me.nome)}{/if}
      </div>
      <div>
        <div class="account-name" id="account-h">{a.me.nome || a.me.email}</div>
        <div class="account-email">{a.me.email}</div>
      </div>
    </div>
  {/if}
{/snippet}
{#snippet error()}
  {#if a.error}<p class="account-error" role="alert">{a.error}</p>{/if}
{/snippet}

<section
  class="sgroup conta"
  id="conta"
  data-testid="account"
  aria-labelledby="account-h"
  aria-live="polite"
  hidden={a.status === "unavailable"}
>
  {#if a.status === "unavailable"}
    <!-- nothing: this build has no Google account -->
  {:else if signedOut}
    <h3 class="account-t" id="account-h">{t("account.title")}</h3>
    <p class="account-s">{t("account.pitch")}</p>
    <button class="gbtn" id="account-signin" disabled={a.status === "connecting"}
      ><GoogleIcon /><span>{t(a.status === "connecting" ? "account.connecting" : "account.sign_in")}</span></button
    >
    {@render error()}
  {:else if a.status === "connected"}
    {@render me()}
    {#if a.devices !== null || a.sync}
      <p class="account-drive ok">{t("account.drive_ok")}{a.devices !== null ? ` · ${t("account.devices", { count: a.devices })}` : ""}</p>
    {:else if !a.error}
      <p class="account-drive">{t("account.drive_checking")}</p>
    {/if}
    {#if a.sync}<p class="account-sync {a.sync.tipo}" id="account-sync">{a.sync.texto}</p>{/if}
    {@render error()}
    <div class="account-actions"><button id="account-signout">{t("account.sign_out")}</button></div>
    <div class="account-more"><button id="account-wipe-cloud">{t("account.wipe_cloud")}</button></div>
  {:else}
    {@render me()}
    <p class="account-drive alerta">{t(a.status === "connecting" ? "account.connecting" : "account.reconnect_hint")}</p>
    {@render error()}
    <div class="account-actions">
      <button class="prim" id="account-signin" disabled={a.status === "connecting"}>{t("account.reconnect")}</button><button
        id="account-signout">{t("account.sign_out")}</button
      >
    </div>
  {/if}
</section>
