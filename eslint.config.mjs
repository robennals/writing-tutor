import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated coverage report.
    "coverage/**",
  ]),
  {
    rules: {
      // Tiptap's useEditor throws an SSR error at runtime unless you pass
      // `immediatelyRender: false`. Catch this in lint instead of at runtime.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='useEditor'] > ObjectExpression:not(:has(Property[key.name='immediatelyRender']))",
          message:
            "useEditor must include `immediatelyRender: false` to avoid SSR hydration errors in Next.js.",
        },
      ],
    },
  },
]);

export default eslintConfig;
