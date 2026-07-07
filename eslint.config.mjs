import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    // ESLint 9 flat config defaults reportUnusedDisableDirectives to "warn";
    // the pre-upgrade `next lint` (eslintrc) left it off. Restore that so the
    // project's existing eslint-disable comments do not become new warnings.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Pre-existing `any` usage throughout the original codebase; kept as a
      // warning so new code is still flagged without failing CI on legacy code.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
