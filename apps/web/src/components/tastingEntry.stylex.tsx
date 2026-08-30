import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, effects, fonts, space } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { BandMark, type RatingBand } from "./scoring.stylex";

export type TastingEntryMember = {
  description?: string;
  descriptionHref?: string;
  href?: string;
  metadata?: string;
  name: string;
  notes?: readonly string[];
  ratingBand?: RatingBand;
};

export type TastingEntryProps = {
  author: string;
  authorHref?: string;
  comment?: string;
  context?: string;
  date: ReactNode;
  leading?: ReactNode;
  members: readonly [TastingEntryMember, ...TastingEntryMember[]];
  menu?: ReactNode;
  surface?: boolean;
};

/** Treats one tasting sitting as one entry whose bottles are member content. */
export function TastingEntry({
  author,
  authorHref,
  comment,
  context,
  date,
  leading,
  members,
  menu,
  surface = false,
}: TastingEntryProps) {
  return (
    <article {...stylex.props(styles.entry, surface && styles.surfaceEntry)}>
      <header {...stylex.props(styles.header)}>
        {leading}
        <div {...stylex.props(styles.headerCopy)}>
          {authorHref ? (
            <AppLink
              href={authorHref}
              {...stylex.props(styles.author, styles.authorLink)}
            >
              {author}
            </AppLink>
          ) : (
            <strong {...stylex.props(styles.author)}>{author}</strong>
          )}
          <span {...stylex.props(styles.date)}>
            {date}
            {context ? (
              <>
                <span aria-hidden="true"> · </span>
                {context}
              </>
            ) : null}
          </span>
        </div>
        {menu ? <div {...stylex.props(styles.menu)}>{menu}</div> : null}
      </header>
      <ul {...stylex.props(styles.members, surface && styles.surfaceMembers)}>
        {members.map((member) => (
          <li
            key={`${member.href ?? member.name}-${member.name}`}
            {...stylex.props(styles.member)}
          >
            <div {...stylex.props(styles.memberCopy)}>
              {member.href ? (
                <AppLink
                  href={member.href}
                  {...stylex.props(styles.name, styles.nameLink)}
                >
                  {member.name}
                </AppLink>
              ) : (
                <span {...stylex.props(styles.name)}>{member.name}</span>
              )}
              {member.metadata ? (
                <span {...stylex.props(styles.metadata)}>
                  {member.metadata}
                </span>
              ) : null}
              {member.notes?.length ? (
                <span {...stylex.props(styles.notes)}>
                  {member.notes.join(" · ")}
                </span>
              ) : null}
              {member.description ? (
                <span {...stylex.props(styles.description)}>
                  <TastingDescription member={member} />
                </span>
              ) : null}
            </div>
            <div {...stylex.props(styles.measure)}>
              {member.ratingBand ? (
                <BandMark band={member.ratingBand} />
              ) : (
                <span {...stylex.props(styles.unknown)}>–</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {comment ? <p {...stylex.props(styles.comment)}>{comment}</p> : null}
    </article>
  );
}

const DESCRIPTION_PREVIEW_LENGTH = 60;

function TastingDescription({ member }: { member: TastingEntryMember }) {
  const description = member.description?.trim().replace(/\s+/g, " ");

  if (
    !member.descriptionHref ||
    !description ||
    description.length <= DESCRIPTION_PREVIEW_LENGTH
  ) {
    return member.description;
  }

  const wordBoundary = description
    .slice(0, DESCRIPTION_PREVIEW_LENGTH + 1)
    .lastIndexOf(" ");
  const cutoff = wordBoundary > 0 ? wordBoundary : DESCRIPTION_PREVIEW_LENGTH;
  const preview = `${description.slice(0, cutoff).trimEnd()}…`;

  return (
    <>
      <span {...stylex.props(styles.descriptionPreview)}>{preview}</span>
      <AppLink
        aria-label={`Read the full tasting notes for ${member.name}`}
        href={member.descriptionHref}
        {...stylex.props(styles.descriptionLink)}
      >
        Read more <span aria-hidden="true">→</span>
      </AppLink>
    </>
  );
}

const styles = stylex.create({
  entry: {
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  surfaceEntry: {
    paddingTop: "22px",
    paddingBottom: "22px",
  },
  header: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
  },
  headerCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
  },
  author: {
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecoration: "none",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  authorLink: {
    color: {
      default: null,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
  },
  date: {
    marginTop: "2px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.35,
  },
  menu: {
    display: "flex",
    flexShrink: 0,
  },
  members: {
    margin: 0,
    marginTop: space.x3,
    padding: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    backgroundColor: "transparent",
    listStyle: "none",
  },
  surfaceMembers: {
    backgroundColor: "transparent",
  },
  member: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x4,
    paddingTop: "12px",
    paddingBottom: "12px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  memberCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
  },
  name: {
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  nameLink: {
    color: {
      default: null,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
  },
  metadata: {
    marginTop: "2px",
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  notes: {
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "12px",
    lineHeight: 1.35,
  },
  description: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  descriptionLink: {
    display: "inline-block",
    marginTop: space.x2,
    color: colors.accentDeep,
    fontWeight: 600,
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    whiteSpace: "nowrap",
  },
  descriptionPreview: {
    display: "block",
  },
  measure: {
    display: "flex",
    minWidth: "76px",
    flexShrink: 0,
    justifyContent: "flex-end",
  },
  unknown: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "12px",
  },
  comment: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
});
