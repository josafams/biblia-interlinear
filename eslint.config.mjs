// ESLint (formato flat, ESLint 9). Estilo fica com o Prettier; aqui só bugs e más práticas.
import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import ts from "typescript-eslint";

const unused = ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }];

export default [
  { ignores: ["node_modules/", "build/", "android/", "ios/", "sources/", "epub-fonts/", "saida/", "**/*.min.js"] },
  js.configs.recommended,
  ...ts.configs.recommended.map(c => ({ ...c, files: ["**/*.ts", "**/*.mts", "**/*.svelte"] })),
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    rules: {
      eqeqeq: ["error", "smart"],
      "no-empty": ["error", { allowEmptyCatch: true }], // catch (_) {} = falha opcional ignorada de propósito
      "no-unused-vars": unused,
      complexity: ["warn", 40],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error"
    }
  },
  {
    // TypeScript and Svelte components (src/, vite/, tests/unit): typescript-eslint knows the types
    files: ["**/*.ts", "**/*.mts", "**/*.svelte"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": unused }
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: [".svelte"] } },
    // Svelte declares props and state with let (let { a } = $props(), let x = $state(…))
    rules: {
      "prefer-const": "off",
      // every {@html} renders escaped text (glossHTML, wordCardsHTML, linkRefs) or trusted locale text with <b>/<i>;
      // each one says so in a comment above it
      "svelte/no-at-html-tags": "off"
    }
  },
  {
    // browser/app code bundled by Vite (src/reader/main.ts imports these as ES modules)
    files: ["web/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser, Dexie: "readonly", google: "readonly", DATA: "readonly" }
    }
  },
  {
    // classic scripts loaded outside the bundle
    files: ["web/google-config.js"],
    languageOptions: { sourceType: "script" }
  },
  {
    // scripts de build, vídeos, testes e configurações (Node, módulos ES)
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.js", "*.mjs"],
    // (testes e roteiros de vídeo também têm funções que rodam dentro da página: page.evaluate)
    languageOptions: { sourceType: "module", globals: { ...globals.node, ...globals.browser, Dexie: "readonly" } }
  }
];
