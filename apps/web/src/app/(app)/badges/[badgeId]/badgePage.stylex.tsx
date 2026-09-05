import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  BadgeImage,
  CursorPager,
  ItemList,
  ItemRow,
  LoadingPlaceholder,
} from "@peated/web/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { foundationStyles } from "../../../../styles/foundations.stylex";
import { colors, controlMetrics } from "../../../../styles/tokens.stylex";

type Badge = Outputs["badges"]["details"];
type AwardList = Outputs["badges"]["userList"];

export function BadgePageFrame({
  badge,
  children,
}: {
  badge: Badge;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.page)}>
      <PageHeader
        description={`Up to level ${badge.maxLevel.toLocaleString("en-US")}`}
        identity={<BadgeImage badge={badge} size={72} />}
        title={badge.name}
      />
      <PageSection heading="Leaderboard">{children}</PageSection>
    </div>
  );
}

export function BadgeLeaderboard({
  awardList,
  badge,
  page,
}: {
  awardList: AwardList;
  badge: Badge;
  page: number;
}) {
  return (
    <>
      <ItemList ariaLabel={`${badge.name} leaderboard`}>
        {awardList.results.map((award, index) => (
          <ItemRow
            end={
              <span {...stylex.props(foundationStyles.metadata, styles.points)}>
                {award.xp.toLocaleString("en-US")} points
              </span>
            }
            href={`/users/${award.user.username}`}
            key={award.id}
            leading={
              <span {...stylex.props(foundationStyles.rowTitle, styles.rank)}>
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
    </>
  );
}

export function BadgeLeaderboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading badge leaderboard" role="status">
      <ItemList ariaLabel="Loading badge leaderboard">
        {([0, 1, 2, 3] as const).map((delay) => (
          <ItemRow
            end={<LoadingPlaceholder delay={delay} preset="metadata" />}
            key={delay}
            leading={<LoadingPlaceholder delay={delay} preset="metadata" />}
            metadata={<LoadingPlaceholder delay={delay} preset="metadata" />}
            title={<LoadingPlaceholder delay={delay} preset="text" />}
          />
        ))}
      </ItemList>
    </div>
  );
}

export function BadgeImageLoading() {
  return <span aria-hidden="true" {...stylex.props(styles.loadingImage)} />;
}

const styles = stylex.create({
  page: { maxWidth: "900px" },
  rank: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  points: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  loadingImage: {
    display: "block",
    width: "72px",
    height: "72px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    boxShadow: `inset 0 0 0 2px ${colors.hairline}`,
  },
});
