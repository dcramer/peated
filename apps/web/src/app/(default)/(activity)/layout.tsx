import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import PendingTosAlert from "@peated/web/components/pendingTosAlert";
import PendingVerificationAlert from "@peated/web/components/pendingVerificationAlert";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { Suspense, type ReactNode } from "react";
import ActivityRailSection from "./activityRailSection";
import NewBottles, { NewBottlesSkeleton } from "./newBottles";
import PriceChanges, { PriceChangesSkeleton } from "./priceChanges";
import UpcomingEvents, { UpcomingEventsSkeleton } from "./upcomingEvents";
// import { PriceChanges, PriceChangesSkeleton } from "./content";

export default async function Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <>
      {user && !user.termsAcceptedAt && <PendingTosAlert />}
      {user && !user.verified && <PendingVerificationAlert />}
      <div className="flex w-full">
        <div className="flex-1 overflow-hidden lg:w-8/12">
          {user && (
            <Tabs fullWidth border noMargin>
              <TabItem as={Link} href="/activity/friends" controlled>
                Friends
              </TabItem>
              <TabItem as={Link} href="/" controlled>
                Global
              </TabItem>
              {/* <TabItem href="/activity/local" controlled>
          Local
        </TabItem> */}
            </Tabs>
          )}
          {children}
        </div>
        <div className="ml-4 hidden w-4/12 lg:block">
          {!user && (
            <div className="relative isolate overflow-hidden border border-slate-700 bg-slate-950 p-5 shadow-lg shadow-black/20">
              <img
                src="/assets/homepage-onboarding-illustration.webp"
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-right"
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/5"
                aria-hidden="true"
              />

              <div className="relative z-10 max-w-[68%]">
                <h2 className="text-xl font-bold leading-tight text-white">
                  Taste. Track. Discover.
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Build your library and remember every great dram.
                </p>
                <div className="mt-4 flex items-center gap-x-3">
                  <Button color="highlight" href="/register" size="small">
                    Join Peated
                  </Button>
                  <Link
                    href="/login"
                    className="text-xs font-semibold text-slate-300 hover:text-white hover:underline"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            </div>
          )}
          <div className={user ? "pt-7" : "mt-8"}>
            <Suspense fallback={<UpcomingEventsSkeleton />}>
              <UpcomingEvents />
            </Suspense>

            <ActivityRailSection title="Newest Bottles">
              <Suspense fallback={<NewBottlesSkeleton />}>
                <NewBottles />
              </Suspense>
            </ActivityRailSection>

            <ActivityRailSection title="Market Prices" badge="Beta">
              <Suspense fallback={<PriceChangesSkeleton />}>
                <PriceChanges />
              </Suspense>
            </ActivityRailSection>

            <ActivityRailSection title="Quick Links">
              <div className="text-muted px-3 text-sm">
                <Link
                  href="/entities/4263/codes"
                  className="text-inherit hover:underline"
                >
                  SMWS Distillery Codes
                </Link>
              </div>
            </ActivityRailSection>
          </div>
        </div>
      </div>
    </>
  );
}
