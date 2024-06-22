"use client";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import { ClientOnly } from "@peated/web/components/clientOnly";
import CollectionAction from "@peated/web/components/collectionAction";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Layout from "@peated/web/components/layout";
import QueryBoundary from "@peated/web/components/queryBoundary";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import Tabs from "@peated/web/components/tabs";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc, trpcClient } from "@peated/web/lib/trpc";
import Link from "next/link";
import { redirect, usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";

// export const meta: MetaFunction<typeof loader> = ({ data }) => {
//   if (!data) return [];

//   const description = summarize(data.bottle.description || "", 200);

//   return [
//     {
//       title: data.bottle.fullName,
//     },
//     {
//       name: "description",
//       content: description,
//     },
//     {
//       property: "og:title",
//       content: data.bottle.fullName,
//     },
//     {
//       property: "og:description",
//       content: description,
//     },
//     {
//       property: "twitter:card",
//       content: "product",
//     },
//   ];
// };

export default function BottleDetails({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const { user } = useAuth();

  const pathname = usePathname();
  const router = useRouter();

  const bottleId = Number(params.bottleId);

  const [bottle] = trpcClient.bottleById.useSuspenseQuery(bottleId);
  // tombstone path - redirect to the absolute url to ensure search engines dont get mad
  if (bottle.id !== bottleId) {
    const newPath = pathname.replace(
      `/bottles/${bottleId}`,
      `/bottles/${bottle.id}`,
    );
    return redirect(newPath);
  }

  const deleteBottleMutation = trpc.bottleDelete.useMutation();
  const deleteBottle = async () => {
    // TODO: show confirmation message
    await deleteBottleMutation.mutateAsync(bottle.id);
    router.push("/");
  };

  const baseUrl = `/bottles/${bottle.id}`;

  return (
    <Layout>
      <div className="w-full p-3 lg:py-0">
        <BottleHeader bottle={bottle} />

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

          <Button href={`/bottles/${bottle.id}/addTasting`} color="primary">
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
                <Menu.Item as={Link} href={`/bottles/${bottle.id}/aliases`}>
                  View Aliases
                </Menu.Item>
                <Menu.Item as={Link} href={`/bottles/${bottle.id}/edit`}>
                  Edit Bottle
                </Menu.Item>
                <Menu.Item as={Link} href={`/bottles/${bottle.id}/merge`}>
                  Merge Bottle
                </Menu.Item>
                {user.admin && (
                  <Menu.Item
                    as={ConfirmationButton}
                    onContinue={deleteBottle}
                    disabled={deleteBottleMutation.isPending}
                  >
                    Delete Bottle
                  </Menu.Item>
                )}
              </Menu.Items>
            </Menu>
          )}
        </div>
      </div>

      <Tabs fullWidth border>
        <Tabs.Item as={Link} href={baseUrl} controlled>
          Overview
        </Tabs.Item>
        <Tabs.Item as={Link} href={`${baseUrl}/tastings`} controlled>
          Tastings ({bottle.totalTastings.toLocaleString()})
        </Tabs.Item>
        <Tabs.Item as={Link} href={`${baseUrl}/prices`} controlled>
          Prices
        </Tabs.Item>
      </Tabs>

      {children}

      {bottle.createdBy && (
        <div className="text-light mt-8 text-center text-sm sm:text-left">
          This bottle was first added by{" "}
          <Link
            href={`/users/${bottle.createdBy.username}`}
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
