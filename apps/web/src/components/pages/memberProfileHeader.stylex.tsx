import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  Chip,
  LoadingPlaceholder,
  TastingRatingDistribution,
  type TastingRatingCounts,
} from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../styles/tokens.stylex";

const FOLDED = "@media (max-width: 899px)";
const PHONE = "@media (max-width: 559px)";

export type MemberProfileHeaderProps = {
  actions?: ReactNode;
  badges?: readonly string[];
  metadata?: readonly string[];
  pictureUrl?: string | null;
  privateProfile?: boolean;
  ratingLabel?: "How they rate" | "How you rate";
  bands?: TastingRatingCounts;
  ratingsLoading?: boolean;
  username: string;
};

/** Presents API-owned member identity, actions, and rating distribution. */
export function MemberProfileHeader({
  actions,
  badges = [],
  metadata = [],
  pictureUrl,
  privateProfile = false,
  ratingLabel = "How they rate",
  bands,
  ratingsLoading = false,
  username,
}: MemberProfileHeaderProps) {
  const showRatings = Boolean(bands || ratingsLoading);

  return (
    <header {...stylex.props(styles.header)}>
      <ProfileAvatar pictureUrl={pictureUrl} username={username} />
      <div {...stylex.props(styles.copy)}>
        {privateProfile || badges.length ? (
          <div {...stylex.props(styles.badges)}>
            {privateProfile ? (
              <Chip variant="tinted">Private profile</Chip>
            ) : null}
            {badges.map((badge) => (
              <Chip key={badge}>{badge}</Chip>
            ))}
          </div>
        ) : null}
        <h1 {...stylex.props(foundationStyles.pageTitle, styles.title)}>
          {username}
        </h1>
        {metadata.length ? (
          <div {...stylex.props(styles.metadata)}>
            {metadata.map((item, index) => (
              <span key={item}>
                {index ? <span aria-hidden="true"> · </span> : null}
                {item}
              </span>
            ))}
          </div>
        ) : null}
        {actions ? (
          <div {...stylex.props(styles.actions)}>{actions}</div>
        ) : null}
      </div>
      {showRatings ? (
        <section aria-label={ratingLabel} {...stylex.props(styles.ratings)}>
          <h2 {...stylex.props(styles.ratingLabel)}>{ratingLabel}</h2>
          {bands ? (
            <TastingRatingDistribution counts={bands} showCounts />
          ) : (
            <div
              aria-busy="true"
              aria-label="Loading member rating distribution"
              role="status"
              {...stylex.props(styles.ratingLoading)}
            >
              <LoadingPlaceholder preset="heading" />
              <LoadingPlaceholder delay={1} preset="text" />
              <LoadingPlaceholder delay={2} preset="metadata" />
            </div>
          )}
        </section>
      ) : null}
    </header>
  );
}

function ProfileAvatar({
  pictureUrl,
  username,
}: {
  pictureUrl?: string | null;
  username: string;
}) {
  return pictureUrl ? (
    <img alt="" src={pictureUrl} {...stylex.props(styles.avatarImage)} />
  ) : (
    <span aria-hidden="true" {...stylex.props(styles.avatarFallback)}>
      {username.slice(0, 2).toLocaleUpperCase()}
    </span>
  );
}

const avatarBase = {
  display: "flex",
  width: "76px",
  height: "76px",
  flexShrink: 0,
  borderRadius: controlMetrics.radius,
  [PHONE]: {
    width: "64px",
    height: "64px",
  },
} as const;

const styles = stylex.create({
  header: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "76px minmax(0, 1fr) 336px",
    alignItems: "start",
    gap: space.x6,
    paddingTop: space.x6,
    paddingBottom: space.x6,
    backgroundColor: "transparent",
    [FOLDED]: {
      gridTemplateColumns: "76px minmax(0, 1fr)",
    },
    [PHONE]: {
      gridTemplateColumns: "64px minmax(0, 1fr)",
      gap: space.x4,
      paddingTop: space.x4,
      paddingBottom: space.x4,
    },
  },
  avatarImage: {
    ...avatarBase,
    objectFit: "cover",
  },
  avatarFallback: {
    ...avatarBase,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: 1,
  },
  copy: {
    minWidth: 0,
  },
  badges: {
    display: "flex",
    gap: space.x2,
    marginBottom: space.x2,
    flexWrap: "wrap",
  },
  title: {
    overflowWrap: "anywhere",
  },
  metadata: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.45,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    marginTop: space.x4,
    flexWrap: "wrap",
  },
  ratings: {
    minWidth: 0,
    [FOLDED]: {
      gridColumn: 2,
    },
    [PHONE]: {
      gridColumn: "1 / -1",
      paddingTop: space.x4,
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: colors.hairline,
    },
  },
  ratingLabel: {
    margin: 0,
    marginBottom: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  ratingLoading: {
    display: "flex",
    minHeight: "66px",
    flexDirection: "column",
    gap: space.x2,
  },
});
