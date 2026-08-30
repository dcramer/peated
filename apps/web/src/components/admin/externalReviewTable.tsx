import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { ExternalReview, PagingRel } from "@peated/server/types";

import { AdminTextLink } from "./adminContent.stylex";
import { AdminTable } from "./adminTable.stylex";

export default function ExternalReviewTable({
  externalReviewList,
  rel,
}: {
  externalReviewList: ExternalReview[];
  rel?: PagingRel;
}) {
  return (
    <ExternalReviewRows externalReviewList={externalReviewList} rel={rel} />
  );
}

export function ExternalReviewRows({
  externalReviewList,
  rel,
}: {
  externalReviewList: ExternalReview[];
  rel?: PagingRel;
}) {
  return (
    <AdminTable
      columns={[
        {
          name: "review",
          value: (review) => (
            <span>
              <AdminTextLink href={review.url}>{review.name}</AdminTextLink>
              {review.bottle ? (
                <>
                  {" · "}
                  <AdminTextLink href={`/bottles/${review.bottle.id}`}>
                    {formatBottleDisplayName(review.bottle)}
                  </AdminTextLink>
                </>
              ) : (
                " · No bottle"
              )}
            </span>
          ),
        },
        {
          align: "right",
          name: "source score",
          value: (review) => review.nativeScore?.display ?? "—",
        },
      ]}
      items={externalReviewList}
      rel={rel}
    />
  );
}
