import { Menu } from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  StarIcon as StarIconFilled,
} from "@heroicons/react/20/solid";
import { StarIcon } from "@heroicons/react/24/outline";
import type { Bottle } from "@peated/server/types";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useNavigate } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import invariant from "tiny-invariant";
import BottleIcon from "~/components/assets/Bottle";
import BottleMetadata from "~/components/bottleMetadata";
import Button from "~/components/button";
import { ClientOnly } from "~/components/clientOnly";
import ConfirmationButton from "~/components/confirmationButton";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import { RangeBarChart } from "~/components/rangeBarChart.client";
import ShareButton from "~/components/shareButton";
import SkeletonButton from "~/components/skeletonButton";
import Tabs from "~/components/tabs";
import TimeSince from "~/components/timeSince";
import useAuth from "~/hooks/useAuth";
import { summarize } from "~/lib/markdown";
import { formatCategoryName } from "~/lib/strings";
import { trpc } from "~/lib/trpc";

export async function loader({
  params,
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(params.bottleId);

  const bottle = await trpc.bottleById.query(Number(params.bottleId));

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
  const navigate = useNavigate();

  const { bottle } = useLoaderData<typeof loader>();

  const stats = [
    {
      name: "Avg Rating",
      value:
        bottle.avgRating !== null
          ? Math.round(bottle.avgRating * 100) / 100
          : "",
    },
    { name: "Tastings", value: bottle.totalTastings.toLocaleString() },
    { name: "People", value: bottle.people.toLocaleString() },
  ];

  const deleteBottleMutation = trpc.bottleDelete.useMutation();
  const deleteBottle = async () => {
    // TODO: show confirmation message
    await deleteBottleMutation.mutateAsync(bottle.id);
    navigate("/");
  };

  const baseUrl = `/bottles/${bottle.id}`;

  return (
    <Layout>
      <div className="w-full p-3 lg:py-0">
        <div className="my-4 flex w-full flex-wrap justify-center gap-x-3 gap-y-4 lg:flex-nowrap lg:justify-start">
          <div className="hidden w-14 lg:block">
            <BottleIcon className="w-14" />
          </div>

          <div className="flex flex-auto flex-col items-center justify-center truncate lg:w-auto lg:items-start">
            <h1
              className="max-w-full truncate text-center text-3xl font-semibold lg:mx-0 lg:text-left"
              title={bottle.fullName}
            >
              {bottle.fullName}
            </h1>
            <BottleMetadata
              data={bottle}
              className="w-full truncate text-center text-slate-500 lg:text-left"
            />
          </div>

          {(bottle.category || bottle.statedAge) && (
            <div className="flex w-full min-w-[150px] flex-col items-center justify-center gap-x-1 text-slate-500 lg:w-auto lg:items-end">
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

        <div className="my-8 flex justify-center gap-4 lg:justify-start">
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

          <ShareButton title={bottle.fullName} url={`/bottles/${bottle.id}`} />

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
                  <Menu.Item
                    as={ConfirmationButton}
                    onContinue={deleteBottle}
                    disabled={deleteBottleMutation.isLoading}
                  >
                    Delete Bottle
                  </Menu.Item>
                )}
              </Menu.Items>
            </Menu>
          )}
        </div>

        <div className="my-6 grid grid-cols-3 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
          {stats.map((stat) => (
            <div key={stat.name}>
              <div className="text-light leading-7">{stat.name}</div>
              <div className="order-first text-3xl font-semibold tracking-tight lg:text-5xl">
                {stat.value || "-"}
              </div>
            </div>
          ))}
          <div className="hidden lg:block">
            <div className="text-light leading-7">Price</div>
            <div className="flex items-center">
              <ClientOnly fallback={<div className="h-[45px] animate-pulse" />}>
                {() => <BottlePriceHistory bottleId={bottle.id} />}
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>

      <Tabs fullWidth border>
        <Tabs.Item as={Link} to={baseUrl} controlled>
          Overview
        </Tabs.Item>
        <Tabs.Item as={Link} to={`${baseUrl}/tastings`} controlled>
          Tastings ({bottle.totalTastings.toLocaleString()})
        </Tabs.Item>
        <Tabs.Item as={Link} to={`${baseUrl}/prices`} controlled>
          Prices
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
    </Layout>
  );
}

function BottlePriceHistory({ bottleId }: { bottleId: number }) {
  const { data, isLoading } = trpc.bottlePriceHistory.useQuery({
    bottle: bottleId,
  });

  if (isLoading) return <div className="h-[45px] animate-pulse" />;

  if (!data) return <div className="h-[45px] animate-pulse" />;

  const points = data.results.reverse().map((r, idx) => {
    return { time: idx, high: r.maxPrice, low: r.minPrice, avg: r.avgPrice };
  });

  return <RangeBarChart data={points} width={200} height={45} />;
}

const CollectionAction = ({ bottle }: { bottle: Bottle }) => {
  const { data: isCollected, isLoading } = trpc.collectionList.useQuery(
    {
      bottle: bottle.id,
      user: "me",
    },
    {
      select: (data) => data.results.length > 0,
    },
  );

  const queryClient = useQueryClient();
  const favoriteBottleMutation = trpc.collectionBottleCreate.useMutation();
  const unfavoriteBottleMutation = trpc.collectionBottleDelete.useMutation();

  if (isCollected === undefined) return null;

  return (
    <>
      <Button
        onClick={async () => {
          isCollected
            ? unfavoriteBottleMutation.mutateAsync({
                bottle: bottle.id,
                user: "me",
                collection: "default",
              })
            : favoriteBottleMutation.mutateAsync({
                bottle: bottle.id,
                user: "me",
                collection: "default",
              });
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
