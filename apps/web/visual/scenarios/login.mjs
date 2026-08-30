import { DESKTOP, MOBILE } from "./viewports.mjs";

export const loginScenario = {
  heading: "Sign in",
  id: "login",
  label: "Login",
  path: "/login",
  shouldRunFor: (filePath) =>
    filePath.startsWith("apps/web/src/app/(layout-free)/login/") ||
    filePath.startsWith("apps/web/src/components/auth/") ||
    filePath === "apps/web/src/components/loginForm.tsx" ||
    filePath === "apps/web/src/components/googleLoginButton.tsx" ||
    filePath === "apps/web/src/components/passkeyLoginButton.tsx" ||
    filePath.includes("/designSystem/patterns/authentication.stylex"),
  viewports: [DESKTOP, MOBILE],
};
