import type { Badge } from "@peated/server/types";
import { BadgeImage } from "@peated/web/components/designSystem/components";
import * as stylex from "@stylexjs/stylex";
import Link from "next/link";

import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, effects, space } from "../../../styles/tokens.stylex";

export function BadgeAwardMessage({
  badge,
  level,
}: {
  badge: Badge;
  level: number;
}) {
  return (
    <Link
      href={`/badges/${badge.id}`}
      prefetch={false}
      {...stylex.props(styles.link)}
    >
      <BadgeImage badge={badge} level={level} size={48} />
      <span {...stylex.props(styles.copy)}>
        <strong {...stylex.props(foundationStyles.rowTitle)}>
          {badge.name}
        </strong>
        <span {...stylex.props(foundationStyles.body, styles.detail)}>
          You've reached level {level}!
        </span>
      </span>
    </Link>
  );
}

const styles = stylex.create({
  link: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
    borderRadius: "2px",
    outline: "none",
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x1,
  },
  detail: {
    color: colors.inkMuted,
  },
});
