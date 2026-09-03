import type { ExternalReview, PagingRel } from "@peated/server/types";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import * as stylex from "@stylexjs/stylex";
import { BottleIdentityRow } from "../bottleIdentityRow.stylex";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { AdminTextLink } from "./adminContent.stylex";
import { AdminTable } from "./adminTable.stylex";

const publishedDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export default function ReviewTable({
  reviews,
  rel,
}: {
  reviews: ExternalReview[];
  rel?: PagingRel;
}) {
  return <ReviewRows reviews={reviews} rel={rel} />;
}

export function ReviewRows({
  reviews,
  rel,
}: {
  reviews: ExternalReview[];
  rel?: PagingRel;
}) {
  return (
    <AdminTable
      columns={[
        {
          fill: true,
          name: "review",
          value: (review) => (
            <div {...stylex.props(styles.review)}>
              <AdminTextLink href={review.url} title={review.name} truncate>
                {review.name}
              </AdminTextLink>
              <div
                {...stylex.props(foundationStyles.metadata, styles.metadata)}
              >
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
              </div>
              {review.bottle ? (
                <BottleIdentityRow
                  {...toBottleListItem(review.bottle)}
                  layout="cell"
                />
              ) : (
                <span {...stylex.props(styles.metadata)}>No bottle</span>
              )}
            </div>
          ),
        },
        {
          align: "right",
          name: "score",
          value: (review) => (
            <span {...stylex.props(styles.score)}>
              {review.nativeScore?.display ?? "—"}
            </span>
          ),
        },
      ]}
      items={reviews}
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
    flexShrink: 0,
    color: colors.inkMuted,
  },
  score: {
    whiteSpace: "nowrap",
  },
});
