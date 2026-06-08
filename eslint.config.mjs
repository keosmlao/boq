import js from "@eslint/js";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", ".next", ".next-dev", ".next-build", "node_modules", "next-env.d.ts"]),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^[A-Z_]" }],
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "warn",
      "no-undef": "off",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-constant-binary-expression": "warn",
    },
    settings: {
      next: {
        rootDir: ["."],
      },
    },
  },
]);
