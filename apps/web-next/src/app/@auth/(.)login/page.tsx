import PeatedLogo from "@peated/web/components/assets/Logo";
import LayoutSplash from "@peated/web/components/layoutSplash";
import LoginForm from "@peated/web/components/loginForm";
import { Modal } from "@peated/web/components/modal";
import Link from "next/link";

export default function Login() {
  return (
    <Modal>
      <LayoutSplash>
        <div className="flex flex-grow items-center justify-center px-4">
          <Link href="/" className="max-w-xs">
            <PeatedLogo className="text-highlight h-auto w-full" />
          </Link>
        </div>

        <LoginForm />

        <div className="mt-6 text-center text-xs">
          <Link href="/about" className="text-highlight underline">
            About Peated
          </Link>
        </div>
      </LayoutSplash>
    </Modal>
  );
}