import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

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
  {
    rules: {
      // Introduced by eslint-plugin-react-hooks v7 (bundled with
      // eslint-config-next 16); absent from the v4 rule set used pre-upgrade.
      // Disabled to keep lint behavior identical without refactoring app code.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
