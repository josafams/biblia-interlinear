<!--
  After the first annotation (once a session; "Agora não" never asks again): save the annotations to Google Drive?
  It gets out of the way when Anotar, a note or Minhas anotações opens, and comes back after. The buttons are
  handled by src/reader/account.ts (ids).
-->
<script lang="ts">
  import { t } from "../i18n";
  import { accountView } from "../state/account.svelte";
  import { annotate } from "../state/annotate.svelte";
  import { note } from "../state/note.svelte";
  import { notes } from "../state/notes.svelte";
  import GoogleIcon from "./GoogleIcon.svelte";

  let { onaway }: { onaway: () => void } = $props();
  $effect(() => {
    if (accountView.suggestion && (annotate.open || note.open || notes.open)) {
      accountView.suggestion = false;
      onaway();
    }
  });
</script>

<div
  class="account-suggestion"
  id="account-suggestion"
  hidden={!accountView.suggestion}
  role="dialog"
  aria-label={t("account.suggestion_label")}
>
  <p>{t("account.suggestion")}</p>
  <div class="linha">
    <button class="gbtn" id="cs-signin"><GoogleIcon /><span>{t("account.sign_in")}</span></button><button class="nao" id="cs-dismiss"
      >{t("account.not_now")}</button
    >
  </div>
</div>
