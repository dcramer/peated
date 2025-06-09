import LayoutSplash from "@peated/web/components/layoutSplash";
import LoginForm from "@peated/web/components/loginForm";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/login")({
  component: Login,
});

function Login() {
  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 font-semibold text-2xl">Welcome Back</h1>
        <p className="text-center text-muted">
          Continue with Google or enter your credentials.
        </p>
      </div>
      <LoginForm />
    </LayoutSplash>
  );
}
