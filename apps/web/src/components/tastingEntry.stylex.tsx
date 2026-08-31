import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { Chip } from "./chip.stylex";
import { TastingRating, type RatingBand } from "./scoring.stylex";
import { TastingToastSummary } from "./tastingToastButton.stylex";

const COMPACT = "@media (max-width: 639px)";
const bottleIconUrl = "/assets/bottle.svg";

export type TastingMediaKind = "bottle" | "photo";

export type TastingEntryMember = {
  color?: string;
  comments?: number;
  description?: string;
  descriptionHref?: string;
  hasToasted?: boolean;
  href?: string;
  imageKind?: TastingMediaKind;
  imageUrl?: string | null;
  metadata?: string;
  name: string;
  notes?: readonly string[];
  ratingBand?: RatingBand;
  servingStyle?: string;
  tastingId?: number;
  toasts?: number;
};

export type TastingEntryProps = {
  author: string;
  authorHref?: string;
  authorId?: number;
  comment?: string;
  context?: string;
  date: ReactNode;
  leading?: ReactNode;
  members: readonly [TastingEntryMember, ...TastingEntryMember[]];
  menu?: ReactNode;
};

/** Treats one tasting sitting as one entry whose bottles are member content. */
export function TastingEntry({
  author,
  authorHref,
  authorId,
  comment,
  context,
  date,
  leading,
  members,
  menu,
}: TastingEntryProps) {
  return (
    <article {...stylex.props(styles.entry)}>
      <ul {...stylex.props(styles.members)}>
        {members.map((member) => (
          <li
            key={`${member.tastingId ?? member.href ?? member.name}-${member.name}`}
            {...stylex.props(styles.member)}
          >
            <TastingMedia
              imageKind={member.imageKind}
              imageUrl={member.imageUrl}
              size="card"
            />
            <div {...stylex.props(styles.memberBody)}>
              <div {...stylex.props(styles.headingRow)}>
                <div {...stylex.props(styles.memberCopy)}>
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
                        <strong {...stylex.props(styles.author)}>
                          {author}
                        </strong>
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
                  </header>
                  {member.href ? (
                    <AppLink
                      href={member.href}
                      title={member.name}
                      {...stylex.props(styles.name, styles.nameLink)}
                    >
                      {member.name}
                    </AppLink>
                  ) : (
                    <span title={member.name} {...stylex.props(styles.name)}>
                      {member.name}
                    </span>
                  )}
                  {member.metadata ? (
                    <span
                      title={member.metadata}
                      {...stylex.props(styles.metadata)}
                    >
                      {member.metadata}
                    </span>
                  ) : null}
                </div>
                <div {...stylex.props(styles.rating)}>
                  {member.ratingBand ? (
                    <TastingRating band={member.ratingBand} />
                  ) : (
                    <span {...stylex.props(styles.unknown)}>–</span>
                  )}
                </div>
                {menu ? <div {...stylex.props(styles.menu)}>{menu}</div> : null}
              </div>
              <p
                {...stylex.props(
                  styles.description,
                  !member.description && styles.emptyDescription,
                )}
              >
                {member.description ? (
                  <TastingDescription member={member} />
                ) : (
                  "No notes."
                )}
              </p>
              {member.notes?.length ? (
                <div {...stylex.props(styles.notes)}>
                  {member.notes.map((note, index) => (
                    <Chip
                      key={`${note}-${index}`}
                      variant={index < 2 ? "tinted" : "neutral"}
                    >
                      {note}
                    </Chip>
                  ))}
                </div>
              ) : null}
              {member.servingStyle || member.color ? (
                <div {...stylex.props(styles.specs)}>
                  {member.servingStyle ? (
                    <span>{member.servingStyle}</span>
                  ) : null}
                  {member.color ? <span>{member.color}</span> : null}
                </div>
              ) : null}
              {member.tastingId !== undefined &&
              (member.toasts !== undefined || member.comments !== undefined) ? (
                <footer {...stylex.props(styles.footer)}>
                  {member.toasts !== undefined ? (
                    <TastingToastSummary
                      authorId={authorId}
                      hasToasted={member.hasToasted}
                      initialCount={member.toasts}
                      tastingId={member.tastingId}
                    />
                  ) : null}
                  {member.comments !== undefined ? (
                    <AppLink
                      href={`/tastings/${member.tastingId}#comments`}
                      {...stylex.props(styles.commentsLink)}
                    >
                      {formatCommentCount(member.comments)}
                    </AppLink>
                  ) : null}
                </footer>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {comment ? <p {...stylex.props(styles.comment)}>{comment}</p> : null}
    </article>
  );
}

export function TastingMedia({
  imageKind = "bottle",
  imageUrl,
  size,
}: {
  imageKind?: TastingMediaKind;
  imageUrl?: string | null;
  size: "card" | "detail";
}) {
  return (
    <span
      aria-hidden="true"
      {...stylex.props(
        styles.media,
        size === "card" ? styles.cardMedia : styles.detailMedia,
        Boolean(imageUrl) && styles.mediaWithImage,
      )}
    >
      {imageUrl ? (
        <img
          alt=""
          src={imageUrl}
          {...stylex.props(
            styles.mediaImage,
            imageKind === "photo" ? styles.photoImage : styles.bottleImage,
          )}
        />
      ) : (
        <span
          style={{
            maskImage: `url("${bottleIconUrl}")`,
            WebkitMaskImage: `url("${bottleIconUrl}")`,
          }}
          {...stylex.props(styles.fallbackAsset)}
        />
      )}
    </span>
  );
}

const DESCRIPTION_PREVIEW_LENGTH = 180;

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
      {preview}{" "}
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

function formatCommentCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "comment" : "comments"}`;
}

const styles = stylex.create({
  entry: {
    width: "100%",
    maxWidth: "760px",
    minWidth: 0,
  },
  members: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  member: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: space.x4,
    paddingTop: "20px",
    paddingBottom: "20px",
    [COMPACT]: {
      gap: space.x3,
      paddingTop: space.x4,
      paddingBottom: space.x4,
    },
  },
  memberBody: {
    minWidth: 0,
    flex: 1,
  },
  headingRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: space.x3,
  },
  memberCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
  },
  header: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x2,
  },
  headerCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    alignItems: "baseline",
    gap: space.x2,
    [COMPACT]: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: "2px",
    },
  },
  author: {
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  authorLink: {
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
  },
  date: {
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  menu: {
    display: "flex",
    flexShrink: 0,
  },
  name: {
    display: "block",
    marginTop: space.x2,
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "19px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.15,
    textDecoration: "none",
    textOverflow: { default: "ellipsis", [COMPACT]: "clip" },
    whiteSpace: { default: "nowrap", [COMPACT]: "normal" },
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  nameLink: {
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
  },
  metadata: {
    marginTop: space.x1,
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
    textOverflow: { default: "ellipsis", [COMPACT]: "clip" },
    whiteSpace: { default: "nowrap", [COMPACT]: "normal" },
  },
  description: {
    margin: 0,
    marginTop: "14px",
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  emptyDescription: {
    color: colors.inkMuted,
  },
  descriptionLink: {
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
  notes: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: space.x3,
  },
  specs: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "14px",
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  rating: {
    display: "flex",
    flexShrink: 0,
    justifyContent: "flex-end",
    paddingTop: space.x1,
  },
  unknown: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "12px",
  },
  footer: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    marginTop: space.x4,
    paddingTop: "14px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    [COMPACT]: {
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
  },
  commentsLink: {
    flexShrink: 0,
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.4,
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  comment: {
    margin: 0,
    marginBottom: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  media: {
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
    color: colors.inkMuted,
  },
  cardMedia: {
    width: "88px",
    height: "88px",
    padding: space.x3,
    [COMPACT]: {
      width: "72px",
      height: "72px",
      padding: space.x2,
    },
  },
  detailMedia: {
    width: "300px",
    height: "300px",
    padding: space.x6,
    [COMPACT]: {
      width: "100%",
      height: "auto",
      aspectRatio: "1 / 1",
    },
  },
  mediaWithImage: {
    backgroundColor: colors.imageBackground,
    boxShadow: `inset 0 0 0 1px ${colors.hairline}`,
    padding: 0,
  },
  mediaImage: {
    display: "block",
    width: "100%",
    height: "100%",
  },
  photoImage: {
    objectFit: "cover",
  },
  bottleImage: {
    objectFit: "contain",
    padding: space.x2,
  },
  fallbackAsset: {
    display: "block",
    width: "42%",
    height: "72%",
    backgroundColor: "currentColor",
    opacity: 0.5,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
  },
});
