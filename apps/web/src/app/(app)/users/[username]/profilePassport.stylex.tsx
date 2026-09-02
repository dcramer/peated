import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import { AppLink, BadgeImage } from "@peated/web/components";
import { colors, fonts, space } from "../../../../styles/tokens.stylex";

type BadgeAward = Outputs["users"]["badgeList"]["results"][number];

export function ProfilePassport({ awards }: { awards: readonly BadgeAward[] }) {
  if (!awards.length) {
    return <p {...stylex.props(styles.empty)}>No stamps yet.</p>;
  }

  return (
    <ul aria-label="Passport stamps" {...stylex.props(styles.list)}>
      {awards.map((award) => (
        <li key={award.id}>
          <AppLink
            href={`/badges/${award.badge.id}`}
            {...stylex.props(styles.stamp)}
          >
            <BadgeImage badge={award.badge} level={award.level} size={40} />
            <span {...stylex.props(styles.copy)}>
              <strong {...stylex.props(styles.name)}>{award.badge.name}</strong>
              <span {...stylex.props(styles.status)}>
                {award.level ? "Stamped" : "In progress"}
              </span>
            </span>
          </AppLink>
        </li>
      ))}
    </ul>
  );
}

const styles = stylex.create({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  stamp: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    color: colors.ink,
    textDecoration: "none",
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  name: {
    overflow: "hidden",
    fontFamily: fonts.display,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.25,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  status: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
  },
  empty: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
});
