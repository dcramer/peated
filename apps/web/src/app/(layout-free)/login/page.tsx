import LayoutSplash from "@peated/web/components/layoutSplash";
import LoginForm from "@peated/web/components/loginForm";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
};

export default function Login() {
  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">Welcome Back</h1>
        <p className="text-muted text-center">
          Continue with Google or enter your credentials.
        </p>
      </div>
      <LoginForm />
    </LayoutSplash>
  );
}
