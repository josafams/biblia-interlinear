<!-- The table of book files (EPUB and PDF) in "Onde ler", with the size of each file built here. -->
<script lang="ts">
  import { t } from "../i18n";

  let { booksUrl, sizes }: { booksUrl: string; sizes: Record<string, string> } = $props();
  // the files of the page's language (scripts/build_epub.py --lang), named in the locale
  const FILES = [
    ["complete", t("edition.files.complete")],
    ["ot", t("edition.files.ot")],
    ["nt", t("edition.files.nt")],
    ["blivre", t("edition.files.text")]
  ] as const;
  // the page of every book file (each book on its own)
  const release = $derived(booksUrl.replace(/\/download\/([^/]+)$/, "/tag/$1"));
</script>

<table>
  <thead>
    <tr>
      <th scope="col">{t("home.books.file")}</th>
      <th scope="col">EPUB</th>
      <th scope="col">{t("home.books.pdf")}</th>
    </tr>
  </thead>
  <tbody>
    {#each FILES as [key, file] (key)}
      <tr>
        <td><b>{t(`home.books.${key}`)}</b><small>{t(`home.books.${key}_note`)}</small></td>
        {#each ["epub", "pdf"] as ext (ext)}<td>
            <a href="{booksUrl}/{file}.{ext}">{t("home.books.download")}</a><span class="sz">{sizes[`${file}.${ext}`] || ""}</span>
          </td>{/each}
      </tr>
    {/each}
    <tr>
      <td><b>{t("home.books.each")}</b><small>{t("home.books.each_note")}</small></td>
      <td><a href={release}>{t("home.books.choose")}</a></td>
      <td><a href={release}>{t("home.books.choose")}</a></td>
    </tr>
  </tbody>
</table>
