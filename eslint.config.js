const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const boundaries = require("eslint-plugin-boundaries");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    plugins: {
      boundaries,
    },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "widgets", pattern: "src/widgets/*", capture: ["name"] },
        { type: "features", pattern: "src/features/*", capture: ["name"] },
        { type: "entities", pattern: "src/entities/*", capture: ["name"] },
        { type: "shared", pattern: "src/shared/*", capture: ["name"] },
      ],
      "boundaries/ignore": [
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
      ],
    },
    rules: {
      "boundaries/no-unknown": "warn",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "app", allow: ["widgets", "features", "entities", "shared"] },
            { from: "widgets", allow: ["features", "entities", "shared"] },
            { from: "features", allow: ["entities", "shared"] },
            { from: "entities", allow: ["shared"] },
            { from: "shared", allow: [] },
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist/*", "node_modules/*", ".expo/*"],
  },
]);
