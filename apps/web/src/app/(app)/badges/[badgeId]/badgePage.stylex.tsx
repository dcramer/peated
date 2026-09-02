import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import {
  BadgeImage,
  CursorPager,
  ItemList,
  ItemRow,
} from "@peated/web/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { colors, fonts } from "../../../../styles/tokens.stylex";

type Badge = Outputs["badges"]["details"];
type AwardList = Outputs["badges"]["userList"];

export function BadgePage({
  awardList,
  badge,
  page,
}: {
  awardList: AwardList;
  badge: Badge;
  page: number;
}) {
  return (
    <div {...stylex.props(styles.page)}>
      <PageHeader
        description={`Up to level ${badge.maxLevel.toLocaleString("en-US")}`}
        identity={<BadgeImage badge={badge} size={72} />}
        title={badge.name}
      />
      <PageSection heading="Leaderboard">
        <ItemList ariaLabel={`${badge.name} leaderboard`}>
          {awardList.results.map((award, index) => (
            <ItemRow
              end={
                <span {...stylex.props(styles.points)}>
                  {award.xp.toLocaleString("en-US")} points
                </span>
              }
              href={`/users/${award.user.username}`}
              key={award.id}
              leading={
                <span {...stylex.props(styles.rank)}>
                  #{(page - 1) * 25 + index + 1}
                </span>
              }
              metadata={`Level ${award.level.toLocaleString("en-US")}`}
              title={award.user.username}
            />
          ))}
        </ItemList>
        <CursorPager
          ariaLabel="Leaderboard pages"
          nextHref={getCursorHref(
            `/badges/${badge.id}`,
            {},
            awardList.rel.nextCursor,
          )}
          page={page}
          previousHref={getCursorHref(
            `/badges/${badge.id}`,
            {},
            awardList.rel.prevCursor,
          )}
        />
      </PageSection>
    </div>
  );
}

const styles = stylex.create({
  page: { maxWidth: "900px" },
  rank: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "16px",
    fontVariantNumeric: "tabular-nums",
  },
  points: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
});
