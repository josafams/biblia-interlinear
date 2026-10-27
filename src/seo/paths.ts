// The public addresses of the static pages for search engines (in Portuguese, like ler.html), relative to the site
// root, always ending in "/": GitHub Pages serves biblia/joao/3/index.html at …/biblia/joao/3/.

/** "Gênesis" → "genesis", "1 João" → "1-joao", "Cânticos" → "canticos". */
export const bookSlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const booksPath = () => "biblia/";
export const bookPath = (name: string) => `biblia/${bookSlug(name)}/`;
export const chapterPath = (name: string, n: number) => `${bookPath(name)}${n}/`;
export const entryPath = (key: string) => `lexico/${encodeURIComponent(key)}/`;

/** The way from a page to the site root: "" at the root, "../../../" from biblia/joao/3/. */
export const toRoot = (path: string) => "../".repeat(path.split("/").filter(Boolean).length);
