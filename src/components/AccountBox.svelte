<!--
  The account in the "Você" tab (#conta): "Entrar com Google" when signed out; the person, Drive and sync status
  when connected; "Reconectar" when the connection expired. The buttons are handled by web/account.js (ids).
-->
<script lang="ts">
  import { t } from "../i18n";
  import { accountView as a } from "../state/account.svelte";

  const initials = (n: string | undefined) =>
    (n || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join("");
  const signedOut = $derived(a.status === "signed-out" || (a.status === "connecting" && !a.me));
</script>

{#snippet google()}
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"
    ><path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    /><path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    /><path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    /><path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    /></svg
  >
{/snippet}
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
      >{@render google()}<span>{t(a.status === "connecting" ? "account.connecting" : "account.sign_in")}</span></button
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
