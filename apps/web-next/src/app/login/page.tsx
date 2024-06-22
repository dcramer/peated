import PeatedLogo from "@peated/web/components/assets/Logo";
import Button from "@peated/web/components/button";
import Form from "@peated/web/components/form";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
import LayoutSplash from "@peated/web/components/layoutSplash";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import { authenticate } from "@peated/web/lib/auth.server";
import { type Metadata } from "next";
import Link from "next/link";

// export const sitemap: SitemapFunction = () => ({
//   exclude: true,
// });

export const metadata: Metadata = {
  title: "Login",
};

function BasicLogin() {
  return (
    <Form action={authenticate} method="post">
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        className="mb-2 rounded"
      />
      <TextField
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="password"
        className="mb-2 rounded"
      />
      <div className="flex justify-center">
        <Button type="submit" color="highlight" fullWidth>
          Sign in
        </Button>
      </div>
    </Form>
  );
}

export default function Login() {
  return (
    <LayoutSplash>
      <div className="flex flex-grow items-center justify-center px-4">
        <Link href="/" className="max-w-xs">
          <PeatedLogo className="text-highlight h-auto w-full" />
        </Link>
      </div>

      <div className="min-w-sm mt-8 flex-auto">
        {/* {error ? <Alert>{error}</Alert> : null} */}
        {config.GOOGLE_CLIENT_ID && (
          <>
            <GoogleLoginButton />
            <div className="relative my-4 text-slate-700">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="min-w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-950 px-2 text-sm">Or</span>
              </div>
            </div>
          </>
        )}
        <BasicLogin />
      </div>
      <div className="mt-6 text-center text-xs">
        <Link href="/about" className="text-highlight underline">
          About Peated
        </Link>
      </div>
    </LayoutSplash>
  );
}
