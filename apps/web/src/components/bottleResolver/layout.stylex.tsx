import * as stylex from "@stylexjs/stylex";
import { Camera } from "lucide-react";
import type { ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import { Button } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";

export function BottleResolverColumn({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.column)}>{children}</div>;
}

export function BottleResolverInlineAction({
  children,
}: {
  children: ReactNode;
}) {
  return <div {...stylex.props(styles.inlineAction)}>{children}</div>;
}

export function BottleResolverIntroduction({
  description,
  title,
}: {
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <header {...stylex.props(styles.introduction)}>
      <h2 {...stylex.props(foundationStyles.pageTitleCompact)}>{title}</h2>
      <div
        {...stylex.props(foundationStyles.body, styles.introductionDescription)}
      >
        {description}
      </div>
    </header>
  );
}

export function BottleResolverSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      {title || description ? (
        <div {...stylex.props(styles.sectionHeader)}>
          {title ? <SectionHeading>{title}</SectionHeading> : null}
          {description ? (
            <div
              {...stylex.props(
                foundationStyles.body,
                styles.sectionDescription,
              )}
            >
              {description}
            </div>
          ) : null}
        </div>
      ) : null}
      <div {...stylex.props(styles.sectionContent)}>{children}</div>
    </section>
  );
}

export function BottlePhotoAction({
  onSelectPhoto,
}: {
  onSelectPhoto: () => void;
}) {
  return (
    <section
      aria-label="Use a label photo"
      {...stylex.props(styles.photoAction)}
    >
      <Button fullWidth onClick={onSelectPhoto} variant="tonal">
        <Camera aria-hidden="true" size={18} />
        Photograph the label
      </Button>
      <p {...stylex.props(foundationStyles.metadata, styles.photoDescription)}>
        Keep the whole front label in frame.
      </p>
    </section>
  );
}

const styles = stylex.create({
  column: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    maxWidth: "620px",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x6,
    marginRight: "auto",
    marginLeft: "auto",
  },
  introduction: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x3,
    paddingBottom: space.x1,
  },
  inlineAction: {
    alignSelf: "flex-start",
  },
  introductionDescription: {
    maxWidth: "520px",
    color: colors.inkMuted,
    textWrap: "pretty",
  },
  section: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x2,
  },
  sectionDescription: {
    maxWidth: "560px",
    color: colors.inkMuted,
    textWrap: "pretty",
  },
  sectionContent: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
  },
  photoAction: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
  },
  photoDescription: {
    margin: 0,
    color: colors.inkMuted,
  },
});
