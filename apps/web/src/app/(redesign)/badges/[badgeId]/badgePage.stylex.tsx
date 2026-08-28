import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import { CursorPager } from "@peated/web/components/designSystem/components";
import {
  PageHeader,
  PageSection,
  RecordList,
  RecordRow,
} from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import {
  colors,
  controlMetrics,
  fonts,
} from "../../../../styles/tokens.stylex";

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
        eyebrow="Community badge"
        identity={<BadgeVisual imageUrl={badge.imageUrl} name={badge.name} />}
        title={badge.name}
      />
      <PageSection count={awardList.results.length} heading="Leaderboard">
        <RecordList ariaLabel={`${badge.name} leaderboard`}>
          {awardList.results.map((award, index) => (
            <RecordRow
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
        </RecordList>
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

function BadgeVisual({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  return imageUrl ? (
    <img alt="" src={imageUrl} {...stylex.props(styles.badgeImage)} />
  ) : (
    <span aria-hidden="true" {...stylex.props(styles.badgeFallback)}>
      {name.slice(0, 2).toLocaleUpperCase()}
    </span>
  );
}

const badgeVisual = {
  display: "flex",
  width: "72px",
  height: "72px",
  flexShrink: 0,
  borderRadius: controlMetrics.radius,
} as const;

const styles = stylex.create({
  page: { maxWidth: "900px" },
  badgeImage: { ...badgeVisual, objectFit: "cover" },
  badgeFallback: {
    ...badgeVisual,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inset,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "18px",
  },
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
