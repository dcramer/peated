import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { ExternalReview, PagingRel } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../../styles/tokens.stylex";
import { AdminTextLink } from "./adminContent.stylex";
import { AdminTable } from "./adminTable.stylex";

const publishedDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

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
            <span {...stylex.props(styles.review)}>
              <span>
                <AdminTextLink href={review.url}>{review.name}</AdminTextLink>
              </span>
              <span {...stylex.props(styles.metadata)}>
                {review.bottle ? (
                  <AdminTextLink href={`/bottles/${review.bottle.id}`}>
                    {formatBottleDisplayName(review.bottle)}
                  </AdminTextLink>
                ) : (
                  "No bottle"
                )}
                {" · "}
                {review.article.publishedAt ? (
                  <time dateTime={review.article.publishedAt}>
                    Published{" "}
                    {publishedDateFormatter.format(
                      new Date(review.article.publishedAt),
                    )}
                  </time>
                ) : (
                  "Publish date unknown"
                )}
              </span>
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

const styles = stylex.create({
  review: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  metadata: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
  },
});
