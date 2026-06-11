import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import importX from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";

const DIRECTIVE_COMMENT = /^\s*(eslint|@ts-|\/\s*<reference)/;

const localPlugin = {
  rules: {
    "no-comments": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Disallow comments except functional directives (eslint-*, @ts-*, triple-slash references)",
        },
        schema: [],
        messages: {
          unexpectedComment:
            "Comments are not allowed - make the code self-explanatory instead.",
        },
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (!DIRECTIVE_COMMENT.test(comment.value)) {
                context.report({
                  loc: comment.loc,
                  messageId: "unexpectedComment",
                });
              }
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  {
    ignores: ["dist/"],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    plugins: {
      "import-x": importX,
      local: localPlugin,
    },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "local/no-comments": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          minimumDescriptionLength: 10,
        },
      ],
      "no-unsafe-optional-chaining": [
        "error",
        {
          disallowArithmeticOperators: true,
        },
      ],
      "no-console": [
        "error",
        {
          allow: ["warn", "error"],
        },
      ],
      complexity: ["error", 5],
      "max-params": ["error", 2],
      "max-depth": ["error", 3],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lodash",
              message:
                "Import the specific module (e.g. lodash/debounce) instead of the whole package.",
            },
          ],
        },
      ],
      "import-x/no-cycle": [
        "error",
        {
          maxDepth: 2,
        },
      ],
      "import-x/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: ["**/*.test.*", "**/*.config.*"],
          packageDir: ["./"],
        },
      ],
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./app/core",
              from: "./app/apps",
              message: "Core must not depend on apps.",
            },
            {
              target: "./app/util",
              from: "./app/core",
              message: "Util must stay leaf-level - no core imports.",
            },
            {
              target: "./app/util",
              from: "./app/apps",
              message: "Util must stay leaf-level - no app imports.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
    },
  },
);
