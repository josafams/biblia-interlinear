<!-- The explanation under the mode selector in Aparência; for "personalizado", the mode it came from. -->
<script lang="ts">
  import { isModeId, modeHint } from "../lib/modes";
  import { reader } from "../state/reader.svelte";
</script>

{isModeId(reader.mode) ? modeHint(reader.mode, reader.baseMode) : ""}
