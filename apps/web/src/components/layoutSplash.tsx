import PeatedLogo from "@peated/web/assets/logo.svg";
import Link from "@peated/web/components/link";
import type { ReactNode } from "react";

export default function LayoutSplash({ children }: { children: ReactNode }) {
  return (
    <div className="bg-slate-950">
      <div className="mx-auto max-w-7xl">
        <main className="flex h-screen">
          <div className="flex flex-auto flex-col items-center lg:h-screen lg:flex-row lg:items-start lg:gap-x-8">
            <div className="relative flex flex-col items-center overflow-hidden lg:h-full lg:w-3/5 lg:bg-slate-950">
              <div className="relative z-10 px-8 py-8 lg:px-6 lg:py-24">
                <div className="max-w-64 lg:mb-8">
                  <Link href="/" className="max-w-xs">
                    <PeatedLogo className="text-muted h-auto w-full" />
                  </Link>
                </div>
                <div className="hidden lg:block">
                  <p className="mb-8 max-w-md text-2xl">
                    Peated is a spirits database dedicated to the discovery of
                    whiskey.
                  </p>
                </div>
              </div>
              <img
                src="/assets/auth-discovery-illustration.webp"
                alt=""
                className="absolute inset-x-0 bottom-0 hidden h-auto w-full lg:block"
              />
            </div>
            <div className="flex-grow px-8 lg:h-full lg:w-2/5 lg:px-6 lg:py-24">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
