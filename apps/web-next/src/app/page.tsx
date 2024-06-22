import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/src/lib/format";
import Button from "@peated/web/components/button";
import Tabs from "@peated/web/components/tabs";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import Link from "next/link";
import { Suspense } from "react";
import BottleLink from "../components/bottleLink";
import { getCurrentUser } from "../lib/auth.server";
import { ActivityContent, PriceChanges, PriceChangesSkeleton } from "./content";

const defaultViewParam = "global";

function mapFilterParam(value: string | null) {
  if (value === "friends" || value === "local") return value;
  return defaultViewParam;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Record<string, any>;
}) {
  const filter = mapFilterParam(searchParams.view);

  const trpc = await getTrpcClient();
  const user = await getCurrentUser();

  const [tastingList, newBottleList] = await Promise.all([
    trpc.tastingList.query({
      filter,
      limit: 10,
    }),
    trpc.bottleList.query({
      sort: "-date",
      limit: 10,
    }),
  ]);

  return (
    <>
      <div className="flex w-full">
        <div className="flex-1 overflow-hidden lg:w-8/12">
          <Tabs fullWidth border>
            {user && (
              <Tabs.Item
                as={Link}
                href="?view=friends"
                active={filter == "friends"}
              >
                Friends
              </Tabs.Item>
            )}
            <Tabs.Item as={Link} href="./" active={filter === "global"}>
              Global
            </Tabs.Item>
            {/* <Tabs.Item href="?view=local" active={filterQ === "local"}>
          Local
        </Tabs.Item> */}
          </Tabs>
          <ActivityContent
            tastingList={tastingList || { results: [] }}
            filter={filter}
          />
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
              <Tabs.Item active>Newest Bottles</Tabs.Item>
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
              <Tabs.Item active>Market Prices</Tabs.Item>
            </Tabs>
            <Suspense fallback={<PriceChangesSkeleton />}>
              <PriceChanges />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
