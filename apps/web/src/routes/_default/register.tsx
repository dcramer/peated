import LayoutSplash from "@peated/web/components/layoutSplash";
import RegisterForm from "@peated/web/components/registerForm";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/register")({
  component: Register,
});

function Register() {
  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 font-semibold text-2xl">Join Us</h1>
        <p className="text-center text-muted">
          Create an account to start exploring the world of whiskey.
        </p>
      </div>
      <RegisterForm />
    </LayoutSplash>
  );
}
