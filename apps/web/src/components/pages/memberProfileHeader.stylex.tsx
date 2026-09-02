import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { Chip } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../styles/tokens.stylex";

const PHONE = "@media (max-width: 559px)";

export type MemberProfileHeaderProps = {
  actions?: ReactNode;
  pictureUrl?: string | null;
  privateProfile?: boolean;
  username: string;
};

/** Presents member identity, private status, and profile actions. */
export function MemberProfileHeader({
  actions,
  pictureUrl,
  privateProfile = false,
  username,
}: MemberProfileHeaderProps) {
  return (
    <header {...stylex.props(styles.header)}>
      <ProfileAvatar pictureUrl={pictureUrl} username={username} />
      <div {...stylex.props(styles.copy)}>
        {privateProfile ? (
          <div {...stylex.props(styles.status)}>
            <Chip variant="tinted">Private profile</Chip>
          </div>
        ) : null}
        <h1 {...stylex.props(foundationStyles.pageTitle, styles.title)}>
          {username}
        </h1>
        {actions ? (
          <div {...stylex.props(styles.actions)}>{actions}</div>
        ) : null}
      </div>
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
    gridTemplateColumns: "76px minmax(0, 1fr)",
    alignItems: "start",
    gap: space.x6,
    paddingTop: space.x6,
    paddingBottom: space.x6,
    backgroundColor: "transparent",
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
  status: {
    display: "flex",
    gap: space.x2,
    marginBottom: space.x2,
    flexWrap: "wrap",
  },
  title: {
    overflowWrap: "anywhere",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    marginTop: space.x4,
    flexWrap: "wrap",
  },
});
