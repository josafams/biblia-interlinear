<!--
  The lexicon entry panel (#detail): a sheet over the bottom of the text on phones, the fixed panel beside the
  text on computers (CSS). LexiconEntry is mounted inside #d-body.
-->
<script lang="ts">
  import { getLocale } from "../i18n";
  import { entry } from "../state/entry.svelte";
</script>

<div
  class="detail"
  id="detail"
  data-testid="lexicon-sheet"
  role="dialog"
  aria-modal="false"
  lang={getLocale()}
  aria-label={entry.view?.ariaLabel}
  hidden={!entry.open}
>
  <div class="detail-inner" id="d-body"></div>
</div>
