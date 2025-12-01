import Button from "@peated/web/components/button";
import LayoutSplash from "@peated/web/components/layoutSplash";
import Link from "@peated/web/components/link";
import config from "@peated/web/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browser Not Supported",
};

export default function BrowserNotSupported() {
  return (
    <LayoutSplash>
      <div className="mb-8 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">Browser Not Supported</h1>
        <p className="text-muted max-w-md text-center">
          Your browser doesn't support passkeys, which are required for secure
          authentication on Peated.
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="mb-3 font-medium">Supported Browsers</h2>
        <ul className="text-muted space-y-1 text-sm">
          <li>Chrome 67+ (Desktop & Android)</li>
          <li>Safari 14+ (macOS & iOS)</li>
          <li>Edge 79+</li>
          <li>Firefox 60+</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        {config.GOOGLE_CLIENT_ID && (
          <Button href="/login" color="highlight" fullWidth>
            Sign in with Google Instead
          </Button>
        )}
        <Button href="/login" color="default" fullWidth>
          Back to Login
        </Button>
        <div className="text-muted mt-2 text-center text-sm">
          <Link
            href="https://passkeys.dev/device-support/"
            className="text-highlight underline"
          >
            Learn more about passkey support
          </Link>
        </div>
      </div>
    </LayoutSplash>
  );
}
