import { AuthenticationPage } from "@peated/web/components/auth/authenticationPage.stylex";
import RegisterForm from "@peated/web/components/registerForm";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function Register() {
  return (
    <AuthenticationPage intro="account">
      <RegisterForm />
    </AuthenticationPage>
  );
}
