"use client";

import { type ExternalSiteType } from "@peated/server/types";
import ReviewTable from "@peated/web/components/admin/reviewTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { trpc } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";

export default function Page({
  params: { siteId },
}: {
  params: { siteId: ExternalSiteType };
}) {
  const searchParams = useSearchParams();
  const numericFields = new Set(["cursor", "limit"]);
  const [reviewList] = trpc.reviewList.useSuspenseQuery({
    site: siteId,
    ...Object.fromEntries(
      [...searchParams.entries()].map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
  });
  return (
    <div>
      {reviewList.results.length > 0 ? (
        <ReviewTable reviewList={reviewList.results} rel={reviewList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
