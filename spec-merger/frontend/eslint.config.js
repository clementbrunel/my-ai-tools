import js from "@eslint/js";
import ts from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default ts.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { plugins: { "react-hooks": reactHooks } },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js"],
    rules: {
      "no-console": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-debugger": "error",
      "@typescript-eslint/no-explicit-any": "warn",
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Config files and tests run under Node / Vitest
    files: ["*.config.{js,ts}", "**/*.test.{ts,tsx}", "src/test/**"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
