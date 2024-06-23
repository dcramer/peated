import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/src/lib/format";
import BottleLink from "@peated/web/components/bottleLink";
import Button from "@peated/web/components/button";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import Link from "next/link";
import { type ReactNode } from "react";
// import { PriceChanges, PriceChangesSkeleton } from "./content";

export default async function Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const trpc = await getTrpcClient();
  const user = await getCurrentUser();

  const newBottleList = await trpc.bottleList.query({
    sort: "-date",
    limit: 10,
  });

  return (
    <>
      <div className="flex w-full">
        <div className="flex-1 overflow-hidden lg:w-8/12">
          <Tabs fullWidth border>
            {user && (
              <TabItem as={Link} href="/activity/friends" controlled>
                Friends
              </TabItem>
            )}
            <TabItem as={Link} href="/" controlled>
              Global
            </TabItem>
            {/* <TabItem href="/activity/local" controlled>
          Local
        </TabItem> */}
          </Tabs>
          {children}
        </div>
        <div className="ml-4 hidden w-4/12 lg:block">
          {!user && (
            <div className="flex flex-col items-center rounded p-4 ring-1 ring-inset ring-slate-800">
              <p className="text-light mb-4 text-sm">
                Create a profile to record tastings, track your favorite
                bottles, and more.
              </p>
              <Button color="primary" href="/login" size="small">
                Sign Up or Login
              </Button>
            </div>
          )}
          <div>
            <Tabs fullWidth>
              <TabItem active>Newest Bottles</TabItem>
            </Tabs>
            <table className="my-2 min-w-full">
              <tbody>
                {newBottleList &&
                  newBottleList.results.map((bottle) => {
                    return (
                      <tr key={bottle.id} className="border-b border-slate-800">
                        <td className="max-w-0 py-2 pl-4 pr-4 text-sm sm:pl-3">
                          <div className="flex items-center space-x-1">
                            <BottleLink
                              bottle={bottle}
                              className="font-medium hover:underline"
                            >
                              {bottle.fullName}
                            </BottleLink>
                            {bottle.isFavorite && (
                              <StarIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                            {bottle.hasTasted && (
                              <CheckBadgeIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          {!!bottle.category && (
                            <div className="text-light text-sm">
                              <Link
                                href={`/bottles/?category=${bottle.category}`}
                                className="hover:underline"
                              >
                                {formatCategoryName(bottle.category)}
                              </Link>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            <Tabs fullWidth>
              <TabItem active>Market Prices</TabItem>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}
