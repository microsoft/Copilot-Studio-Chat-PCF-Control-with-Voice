import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import pluginPromise from "eslint-plugin-promise";
import powerAppsPlugin from "@microsoft/eslint-plugin-power-apps";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  pluginPromise.configs["flat/recommended"],
  {
    plugins: {
      "@microsoft/power-apps": powerAppsPlugin,
      react: pluginReact,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/prop-types": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    ignores: ["**/generated/**", "**/node_modules/**", "**/out/**", "**/obj/**"],
  }
);
