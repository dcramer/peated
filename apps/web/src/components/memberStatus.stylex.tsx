import * as stylex from "@stylexjs/stylex";

import { colors } from "../styles/tokens.stylex";

export type MemberStatusKind = "following" | "library" | "tasted";

const labels = {
  following: "Following",
  library: "In Library",
  tasted: "Tasted",
} satisfies Record<MemberStatusKind, string>;

/** Shows personal catalog state beside a name without acting as a control. */
export function MemberStatus({ kind }: { kind: MemberStatusKind }) {
  const label = labels[kind];

  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      {...stylex.props(styles.status)}
    >
      {kind === "library" ? (
        <LibraryIcon />
      ) : kind === "tasted" ? (
        <TastedIcon />
      ) : (
        <FollowingIcon />
      )}
    </span>
  );
}

function LibraryIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="12"
      viewBox="0 0 16 16"
      width="12"
    >
      <path
        d="M8 4.2C6.9 3.4 5.4 3 3.5 3H2v9h1.5c1.9 0 3.4.4 4.5 1.2 1.1-.8 2.6-1.2 4.5-1.2H14V3h-1.5C10.6 3 9.1 3.4 8 4.2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path d="M8 4.4v8.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function TastedIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="12"
      viewBox="0 0 16 16"
      width="12"
    >
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.6 8.2 7.3 9.9l3.1-3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function FollowingIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="12"
      viewBox="0 0 16 16"
      width="12"
    >
      <path
        d="M1.6 8s2.2-3.5 6.4-3.5S14.4 8 14.4 8 12.2 11.5 8 11.5 1.6 8 1.6 8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

const styles = stylex.create({
  status: {
    display: "inline-flex",
    marginLeft: "6px",
    color: colors.inkMuted,
    verticalAlign: "-1px",
  },
});
