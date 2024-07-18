"use client";

import { type ExternalSiteType } from "@peated/server/types";
import StorePriceTable from "@peated/web/components/admin/storePriceTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { trpc } from "@peated/web/lib/trpc/client";
import { useSearchParams } from "next/navigation";

export default function Page({
  params: { siteId },
}: {
  params: { siteId: ExternalSiteType };
}) {
  const searchParams = useSearchParams();
  const [priceList] = trpc.priceList.useSuspenseQuery({
    site: siteId,
    ...Object.fromEntries(searchParams.entries()),
  });
  return (
    <div>
      {priceList.results.length > 0 ? (
        <StorePriceTable priceList={priceList.results} rel={priceList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
