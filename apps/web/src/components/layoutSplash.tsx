import PeatedLogo from "@peated/web/assets/logo.svg";
import Link from "@peated/web/components/link";
import type { ReactNode } from "react";

export default function LayoutSplash({ children }: { children: ReactNode }) {
  return (
    <div className="bg-slate-900">
      <div className="mx-auto max-w-7xl">
        <main className="flex h-screen">
          <div className="flex flex-auto flex-col items-center lg:h-screen lg:flex-row lg:items-start lg:gap-x-8">
            <div className="flex flex-col items-center border-slate-950 from-slate-950 to-slate-900 lg:h-full lg:w-3/5 lg:border-r-2 lg:bg-gradient-to-l">
              <div className="px-8 py-8 lg:px-6 lg:py-24">
                <div className="max-w-64 lg:mb-8">
                  <Link href="/" className="max-w-xs">
                    <PeatedLogo className="h-auto w-full text-highlight" />
                  </Link>
                </div>
                <div className="hidden lg:block">
                  <p className="mb-8 max-w-md text-2xl">
                    Peated is a spirits database dedicated to the discovery of
                    whiskey.
                  </p>
                  <img
                    src="/assets/splash.png"
                    alt="depicts a bunch of folks drinking whisky at a bar"
                    className="mt-32 max-w-lg"
                  />
                </div>
              </div>
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
