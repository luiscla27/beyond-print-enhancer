const globals = require("globals");
const pluginJs = require("@eslint/js");

module.exports = [
  {
    ignores: ["eslint.config.js", "conductor/"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
  pluginJs.configs.recommended,
];