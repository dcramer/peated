import { ProductAuthShell } from "@peated/web/components/designSystem/product/authPageShell.stylex";
import RegisterForm from "@peated/web/components/registerForm";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function Register() {
  return (
    <ProductAuthShell intro="account">
      <RegisterForm />
    </ProductAuthShell>
  );
}
