import { Menu } from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  StarIcon as StarIconFilled,
} from "@heroicons/react/20/solid";
import { ShareIcon, StarIcon } from "@heroicons/react/24/outline";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useNavigate } from "@remix-run/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment } from "react";
import invariant from "tiny-invariant";

import type { Bottle } from "@peated/shared/types";
import RobotImage from "~/assets/robot.png";
import BottleIcon from "~/components/assets/Bottle";
import BetaNotice from "~/components/betaNotice";
import BottleMetadata from "~/components/bottleMetadata";
import Button from "~/components/button";
import { ClientOnly } from "~/components/clientOnly";
import Collapsable from "~/components/collapsable";
import ConfirmationButton from "~/components/confirmationButton";
import { DistributionChart } from "~/components/distributionChart";
import Layout from "~/components/layout";
import Markdown from "~/components/markdown";
import QueryBoundary from "~/components/queryBoundary";
import { RangeBarChart } from "~/components/rangeBarChart.client";
import SkeletonButton from "~/components/skeletonButton";
import Tabs from "~/components/tabs";
import TimeSince from "~/components/timeSince";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { summarize } from "~/lib/markdown";
import { formatCategoryName } from "~/lib/strings";
import {
  fetchBottlePriceHistory,
  fetchBottlePrices,
  fetchBottleTags,
  getBottle,
} from "~/queries/bottles";
import {
  favoriteBottle,
  fetchCollections,
  unfavoriteBottle,
} from "~/queries/collections";

const CollectionAction = ({ bottle }: { bottle: Bottle }) => {
  const api = useApi();

  const { data: isCollected, isLoading } = useQuery(
    ["bottles", bottle.id, "isCollected"],
    async () => {
      const res = await fetchCollections(api, "me", {
        bottle: bottle.id,
      });
      return res.results.length > 0;
    },
  );

  const queryClient = useQueryClient();
  const collectBottle = useMutation({
    mutationFn: async (collect: boolean) => {
      if (!collect) {
        return await unfavoriteBottle(api, bottle.id);
      } else {
        return await favoriteBottle(api, bottle.id);
      }
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["bottles", bottle.id, "isCollected"], newData);
    },
  });

  if (isCollected === undefined) return null;

  return (
    <>
      <Button
        onClick={async () => {
          await collectBottle.mutateAsync(!isCollected);
        }}
        disabled={isLoading}
        color="primary"
      >
        {isCollected ? (
          <StarIconFilled
            className="text-highlight h-4 w-4"
            aria-hidden="true"
          />
        ) : (
          <StarIcon className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </>
  );
};

const BottleTagDistribution = ({ bottleId }: { bottleId: number }) => {
  const api = useApi();

  const { data } = useQuery(["bottles", bottleId, "tags"], () =>
    fetchBottleTags(api, bottleId),
  );

  if (!data) return null;

  const { results, totalCount } = data;

  if (!results.length) return null;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: t.tag,
        count: t.count,
        tag: t.tag,
      }))}
      totalCount={totalCount}
      to={(item) => `/bottles?tag=${encodeURIComponent(item.name)}`}
    />
  );
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  invariant(params.bottleId);

  const bottle = await getBottle(context.api, params.bottleId);

  return json({ bottle });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  const description = summarize(data.bottle.description || "", 200);

  return [
    {
      title: data.bottle.fullName,
    },
    {
      name: "description",
      content: description,
    },
    {
      property: "og:title",
      content: data.bottle.fullName,
    },
    {
      property: "og:description",
      content: description,
    },
    {
      property: "twitter:card",
      content: "product",
    },
  ];
};

export default function BottleDetails() {
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();

  const { bottle } = useLoaderData<typeof loader>();

  const stats = [
    {
      name: "Avg Rating",
      value: Math.round(bottle.avgRating * 100) / 100,
    },
    { name: "Tastings", value: bottle.totalTastings.toLocaleString() },
    { name: "People", value: bottle.people.toLocaleString() },
  ];

  const deleteBottle = async () => {
    // TODO: show confirmation message
    await api.delete(`/bottles/${bottle.id}`);
    navigate("/");
  };

  return (
    <Layout>
      <div className="p-3 sm:py-0">
        <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 sm:flex-nowrap">
          <BottleIcon className="hidden h-14 w-auto sm:inline-block" />
          <div className="w-full flex-1 flex-col items-center sm:w-auto sm:items-start">
            <h1
              className="mx-auto max-w-[260px] truncate text-center text-3xl font-semibold sm:mx-0 sm:max-w-[480px] sm:text-left"
              title={bottle.fullName}
            >
              {bottle.name}
            </h1>
            <BottleMetadata
              data={bottle}
              className="text-center text-sm text-slate-500 sm:text-left"
            />
          </div>

          {(bottle.category || bottle.statedAge) && (
            <div className="flex w-full flex-col items-center justify-center gap-x-1 text-sm text-slate-500 sm:w-auto sm:items-end">
              <div>
                {bottle.category && (
                  <Link
                    to={`/bottles?category=${encodeURIComponent(
                      bottle.category,
                    )}`}
                  >
                    {formatCategoryName(bottle.category)}
                  </Link>
                )}
              </div>
              <div>
                {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
              </div>
            </div>
          )}
        </div>

        <div className="my-8 flex justify-center gap-4 sm:justify-start">
          {user && (
            <ClientOnly fallback={<SkeletonButton className="w-10" />}>
              {() => (
                <QueryBoundary
                  loading={<SkeletonButton className="w-10" />}
                  fallback={() => null}
                >
                  <CollectionAction bottle={bottle} />
                </QueryBoundary>
              )}
            </ClientOnly>
          )}

          <Button to={`/bottles/${bottle.id}/addTasting`} color="primary">
            Record a Tasting
          </Button>

          <Button
            icon={<ShareIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />}
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: bottle.fullName,
                    url: `/bottles/${bottle.id}`,
                  })
                  .catch((error) => console.error("Error sharing", error));
              }
            }}
          />

          {user?.mod && (
            <Menu as="div" className="menu">
              <Menu.Button as={Button}>
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Menu.Button>
              <Menu.Items
                className="absolute right-0 z-10 mt-2 w-32 origin-top-right"
                unmount={false}
              >
                <Menu.Item as={Link} to={`/bottles/${bottle.id}/edit`}>
                  Edit Bottle
                </Menu.Item>
                {user.admin && (
                  <Menu.Item as={ConfirmationButton} onContinue={deleteBottle}>
                    Delete Bottle
                  </Menu.Item>
                )}
              </Menu.Items>
            </Menu>
          )}
        </div>

        <ClientOnly
          fallback={
            <div
              className="mb-4 animate-pulse bg-slate-800"
              style={{ height: 200 }}
            />
          }
        >
          {() => (
            <QueryBoundary
              fallback={
                <div
                  className="mb-4 animate-pulse bg-slate-800"
                  style={{ height: 200 }}
                />
              }
              loading={<Fragment />}
            >
              <BottleTagDistribution bottleId={bottle.id} />
            </QueryBoundary>
          )}
        </ClientOnly>

        <div className="my-6 grid grid-cols-3 items-center gap-3 text-center sm:text-left">
          {stats.map((stat) => (
            <div key={stat.name}>
              <div className="text-light leading-7">{stat.name}</div>
              <div className="order-first text-3xl font-semibold tracking-tight sm:text-5xl">
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {bottle.description && (
        <div className="flex">
          <div className="flex-1">
            <Tabs fullWidth border>
              <Tabs.Item active>About</Tabs.Item>
            </Tabs>
            <div className="my-6">
              <div className="mt-5 flex space-x-4">
                <Collapsable mobileOnly>
                  <div className="prose prose-invert -mt-5 max-w-none flex-1">
                    <Markdown content={bottle.description} />
                  </div>
                  {bottle.tastingNotes && (
                    <>
                      <h3 className="text-highlight text-lg font-bold">
                        Tasting Notes
                      </h3>
                      <div className="prose prose-invert max-w-none flex-1">
                        <dl>
                          <dt>Nose</dt>
                          <dd>{bottle.tastingNotes.nose}</dd>
                          <dt>Palate</dt>
                          <dd>{bottle.tastingNotes.palate}</dd>
                          <dt>Finish</dt>
                          <dd>{bottle.tastingNotes.finish}</dd>
                        </dl>
                      </div>
                    </>
                  )}
                </Collapsable>

                <img src={RobotImage} className="hidden h-40 w-40 sm:block" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        <div className="flex-1">
          <Tabs fullWidth border>
            <Tabs.Item as={Link} to={`/bottles/${bottle.id}`} controlled>
              Activity
            </Tabs.Item>
          </Tabs>

          <Outlet context={{ bottle }} />

          {bottle.createdBy && (
            <div className="mt-8 text-center text-sm text-slate-500 sm:text-left">
              This bottle was first added by{" "}
              <Link
                to={`/users/${bottle.createdBy.username}`}
                className="font-medium hover:underline"
              >
                {bottle.createdBy.displayName}
              </Link>{" "}
              {bottle.createdAt && <TimeSince date={bottle.createdAt} />}
            </div>
          )}
        </div>
        <div className="ml-4 hidden w-[200px] sm:block">
          <ClientOnly fallback={<BottlePricesSkeleton />}>
            {() => (
              <QueryBoundary loading={<BottlePricesSkeleton />}>
                <BottlePrices bottleId={bottle.id} />
              </QueryBoundary>
            )}
          </ClientOnly>
        </div>
      </div>
    </Layout>
  );
}

function BottlePricesSkeleton() {
  return (
    <div>
      <Tabs fullWidth>
        <Tabs.Item active>Prices</Tabs.Item>
      </Tabs>
      <div
        className="mt-4 animate-pulse bg-slate-800"
        style={{ height: 200 }}
      />
    </div>
  );
}

function BottlePriceHistory({ bottleId }: { bottleId: number }) {
  const api = useApi();
  const { data, isLoading } = useQuery(
    ["bottles", bottleId, "priceHistory"],
    () => fetchBottlePriceHistory(api, bottleId),
  );

  if (isLoading) return <div className="h-6 animate-pulse" />;

  if (!data) return null;

  const points = data.results.reverse().map((r, idx) => {
    return { time: idx, high: r.maxPrice, low: r.minPrice, avg: r.avgPrice };
  });

  return <RangeBarChart data={points} width={200} height={100} />;
}

function BottlePrices({ bottleId }: { bottleId: number }) {
  const api = useApi();
  const { data } = useQuery(["bottles", bottleId, "prices"], () =>
    fetchBottlePrices(api, bottleId),
  );

  if (!data) return null;
  return (
    <div>
      <Tabs fullWidth>
        <Tabs.Item active>Prices</Tabs.Item>
      </Tabs>

      <div className="mt-4">
        <BetaNotice>This is a work in progress.</BetaNotice>

        <ClientOnly fallback={<div className="h-6 animate-pulse" />}>
          {() => <BottlePriceHistory bottleId={bottleId} />}
        </ClientOnly>

        {data.results.length ? (
          <ul className="mt-4 space-y-2 text-sm">
            {data.results.map((price) => {
              return (
                <li key={price.id}>
                  <a href={price.url} className="flex hover:underline">
                    <span className="flex-1">{price.store?.name}</span>
                    <span>${(price.price / 100).toFixed(2)}</span>
                  </a>
                  <span className="text-light text-xs">
                    {price.volume}mL &mdash;{" "}
                    <TimeSince date={price.updatedAt} />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-center text-sm">No sellers found.</p>
        )}
      </div>
    </div>
  );
}
