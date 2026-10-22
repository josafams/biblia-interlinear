// ESLint (formato flat, ESLint 9). Estilo fica com o Prettier; aqui só bugs e más práticas.
import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["node_modules/", "build/", "android/", "ios/", "sources/", "epub-fonts/", "**/*.min.js"] },
  js.configs.recommended,
  prettier,
  {
    rules: {
      eqeqeq: ["error", "smart"],
      "no-empty": ["error", { allowEmptyCatch: true }], // catch (_) {} = falha opcional ignorada de propósito
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      complexity: ["warn", 40],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error"
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
    files: ["web/google-config.js", "web/home.js"],
    languageOptions: { sourceType: "script" }
  },
  {
    // scripts de build, vídeos, testes e configurações (Node, módulos ES)
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.js", "*.mjs"],
    // (testes e roteiros de vídeo também têm funções que rodam dentro da página: page.evaluate)
    languageOptions: { sourceType: "module", globals: { ...globals.node, ...globals.browser, Dexie: "readonly" } }
  }
];
