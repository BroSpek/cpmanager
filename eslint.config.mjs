import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        CPManager: "writable",
        Chart: "readonly", // Add Chart here
        jsPDF: "readonly", // Add jsPDF here
        autoTable: "readonly", // Add autoTable here
      },
    },
    rules: {
      // You can add this rule to explicitly ignore the 'isCurrentlyExpanded' unused variable,
      // although removing the variable directly from the code is cleaner.
      // 'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^isCurrentlyExpanded$' }],

      // This rule helps enforce using Object.prototype.hasOwnProperty.call()
      // If you're okay with the direct .hasOwnProperty() call and just want to suppress the error,
      // you could disable it, but it's generally better to fix the code as previously suggested.
      "no-prototype-builtins": "off", // You can turn this off if you don't want to fix it.
      // But the previous suggestion was to fix the code using Object.prototype.hasOwnProperty.call()
    },
  },
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },

  // This is the final, crucial piece.
  // It MUST be the last element to override other style rules.
  prettierConfig,
]);
