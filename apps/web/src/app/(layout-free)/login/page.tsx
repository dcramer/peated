import PeatedLogo from "@peated/web/assets/logo.svg";
import LayoutSplash from "@peated/web/components/layoutSplash";
import LoginForm from "@peated/web/components/loginForm";
import { type Metadata } from "next";
import Link from "next/link";

// export const sitemap: SitemapFunction = () => ({
//   exclude: true,
// });

export const metadata: Metadata = {
  title: "Login",
};

export default function Login() {
  return (
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
  );
}
