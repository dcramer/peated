"use client";

import * as stylex from "@stylexjs/stylex";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { Button, IconButton, LoadingList } from "../components";

export type WorkflowScreenProps = {
  children: ReactNode;
  onClose?: () => void;
  onSave?: (event: FormEvent<HTMLButtonElement>) => void;
  saveLabel?: string;
  saving?: boolean;
  title: string;
};

/** Keeps add and edit workflows usable without the full application chrome. */
export function WorkflowScreen({
  children,
  onClose,
  onSave,
  saveLabel = "Save",
  saving = false,
  title,
}: WorkflowScreenProps) {
  const router = useRouter();

  return (
    <main {...stylex.props(foundationStyles.document, styles.screen)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.headerInner)}>
          <IconButton
            icon={<ArrowLeft aria-hidden="true" size={17} />}
            label="Go back"
            onClick={() => (onClose ? onClose() : router.back())}
            size="sm"
            variant="text"
          />
          <Link href="/" {...stylex.props(styles.brand)}>
            Peated
          </Link>
          <h1 {...stylex.props(styles.title)}>{title}</h1>
          {onSave ? (
            <Button
              loading={saving}
              loadingLabel="Saving…"
              onClick={onSave}
              size="sm"
              variant="accent"
            >
              {saveLabel}
            </Button>
          ) : (
            <span />
          )}
        </div>
      </header>
      <div {...stylex.props(styles.content)}>{children}</div>
    </main>
  );
}

/** Reserves the standalone workflow frame while its route data loads. */
export function WorkflowLoading({
  label = "Loading form",
  title = "Loading",
}: {
  label?: string;
  title?: string;
}) {
  return (
    <WorkflowScreen title={title}>
      <LoadingList label={label} rows={3} />
    </WorkflowScreen>
  );
}

const styles = stylex.create({
  screen: {
    minHeight: "100dvh",
    backgroundColor: colors.ground,
    color: colors.ink,
  },
  header: {
    position: "sticky",
    zIndex: 20,
    top: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  headerInner: {
    boxSizing: "border-box",
    display: "grid",
    width: "100%",
    maxWidth: "960px",
    minHeight: "56px",
    gridTemplateColumns: "34px auto minmax(0, 1fr) auto",
    alignItems: "center",
    columnGap: space.x3,
    marginRight: "auto",
    marginLeft: "auto",
    paddingRight: space.x6,
    paddingLeft: space.x6,
    "@media (max-width: 559px)": {
      gridTemplateColumns: "34px minmax(0, 1fr) auto",
      paddingRight: space.x3,
      paddingLeft: space.x3,
    },
  },
  brand: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    textDecoration: "none",
    outline: "none",
    borderRadius: controlMetrics.radiusSmall,
    "@media (max-width: 559px)": { display: "none" },
  },
  title: {
    minWidth: 0,
    margin: 0,
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  content: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "760px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingTop: space.x8,
    paddingRight: space.x6,
    paddingBottom: space.x12,
    paddingLeft: space.x6,
    "@media (max-width: 559px)": {
      paddingTop: space.x4,
      paddingRight: space.x3,
      paddingBottom: space.x8,
      paddingLeft: space.x3,
    },
  },
});
