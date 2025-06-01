import LayoutSplash from "@peated/web/components/layoutSplash";
import RegisterForm from "@peated/web/components/registerForm";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/register")({
  component: Register,
});

function Register() {
  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">Join Us</h1>
        <p className="text-muted text-center">
          Create an account to start exploring the world of whiskey.
        </p>
      </div>
      <RegisterForm />
    </LayoutSplash>
  );
}
