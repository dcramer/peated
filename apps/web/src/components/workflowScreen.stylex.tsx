"use client";

import * as stylex from "@stylexjs/stylex";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

import { Button, IconButton, LoadingList } from "@peated/web/components";
import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
  zIndices,
} from "../styles/tokens.stylex";

export type WorkflowScreenProps = {
  children: ReactNode;
  mobileSaveBar?: boolean;
  onClose?: () => void;
  onPrevious?: (event: FormEvent<HTMLButtonElement>) => void;
  onSave?: (event: FormEvent<HTMLButtonElement>) => void;
  previousLabel?: string;
  saveDisabled?: boolean;
  saveHint?: ReactNode;
  saveLabel?: string;
  saving?: boolean;
  title: string;
};

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton
      icon={<ArrowLeft aria-hidden="true" size={17} />}
      label="Go back"
      onClick={onClick}
      size="sm"
      variant="text"
    />
  );
}

function RouterBackButton() {
  const router = useRouter();

  return <BackButton onClick={() => router.back()} />;
}

/** Keeps add and edit workflows usable without the full application chrome. */
export function WorkflowScreen({
  children,
  mobileSaveBar = false,
  onClose,
  onPrevious,
  onSave,
  previousLabel = "Back",
  saveDisabled = false,
  saveHint,
  saveLabel = "Save",
  saving = false,
  title,
}: WorkflowScreenProps) {
  return (
    <main {...stylex.props(foundationStyles.document, styles.screen)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.headerInner)}>
          <div {...stylex.props(styles.headerLeading)}>
            {onClose ? <BackButton onClick={onClose} /> : <RouterBackButton />}
            <Link href="/" {...stylex.props(styles.brand)}>
              Peated
            </Link>
          </div>
          <h1
            title={title}
            {...stylex.props(foundationStyles.compactRowTitle, styles.title)}
          >
            {title}
          </h1>
          {onSave ? (
            <span
              {...stylex.props(
                styles.headerActions,
                mobileSaveBar && styles.mobileHeaderSave,
              )}
            >
              {onPrevious ? (
                <Button
                  disabled={saving}
                  onClick={onPrevious}
                  size="sm"
                  variant="tonal"
                >
                  {previousLabel}
                </Button>
              ) : null}
              <Button
                disabled={saveDisabled}
                loading={saving}
                loadingLabel="Saving…"
                onClick={onSave}
                size="sm"
                variant="accent"
              >
                {saveLabel}
              </Button>
            </span>
          ) : (
            <span />
          )}
        </div>
      </header>
      <div
        {...stylex.props(
          styles.content,
          mobileSaveBar && styles.contentWithMobileSave,
          mobileSaveBar &&
            Boolean(saveHint) &&
            styles.contentWithMobileSaveHint,
        )}
      >
        {children}
      </div>
      {onSave && mobileSaveBar ? (
        <div {...stylex.props(styles.mobileSaveBar)}>
          <div {...stylex.props(styles.mobileSaveInner)}>
            {saveHint ? (
              <p {...stylex.props(foundationStyles.metadata, styles.saveHint)}>
                {saveHint}
              </p>
            ) : null}
            <div
              {...stylex.props(
                styles.mobileActions,
                !onPrevious && styles.singleMobileAction,
              )}
            >
              {onPrevious ? (
                <Button
                  disabled={saving}
                  fullWidth
                  onClick={onPrevious}
                  size="lg"
                  variant="tonal"
                >
                  {previousLabel}
                </Button>
              ) : null}
              <Button
                disabled={saveDisabled}
                fullWidth
                loading={saving}
                loadingLabel="Saving…"
                onClick={onSave}
                size="lg"
                variant="accent"
              >
                {saveLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
    zIndex: zIndices.sticky,
    top: 0,
    paddingTop: "env(safe-area-inset-top)",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
    backgroundColor: colors.ground,
  },
  headerInner: {
    boxSizing: "border-box",
    display: "grid",
    width: "100%",
    maxWidth: "960px",
    minHeight: "56px",
    gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
    alignItems: "center",
    columnGap: space.x3,
    marginRight: "auto",
    marginLeft: "auto",
    paddingRight: `max(${space.x6}, env(safe-area-inset-right))`,
    paddingLeft: `max(${space.x6}, env(safe-area-inset-left))`,
    "@media (max-width: 559px)": {
      paddingRight: `max(${space.x3}, env(safe-area-inset-right))`,
      paddingLeft: `max(${space.x3}, env(safe-area-inset-left))`,
    },
  },
  headerLeading: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    justifySelf: "start",
    gap: space.x3,
  },
  brand: {
    color: { default: colors.ink, ":hover": colors.accentDeep },
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    textDecoration: "none",
    outline: "none",
    borderRadius: controlMetrics.radiusSmall,
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    "@media (max-width: 559px)": { display: "none" },
  },
  title: {
    minWidth: 0,
    margin: 0,
    overflow: "hidden",
    color: colors.ink,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    justifySelf: "end",
    gap: space.x2,
  },
  content: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "760px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingTop: space.x8,
    paddingRight: `max(${space.x6}, env(safe-area-inset-right))`,
    paddingBottom: `max(${space.x12}, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${space.x6}, env(safe-area-inset-left))`,
    "@media (max-width: 559px)": {
      paddingTop: space.x4,
      paddingRight: `max(${space.x3}, env(safe-area-inset-right))`,
      paddingBottom: `max(${space.x8}, env(safe-area-inset-bottom))`,
      paddingLeft: `max(${space.x3}, env(safe-area-inset-left))`,
    },
  },
  mobileHeaderSave: {
    "@media (max-width: 559px)": { display: "none" },
  },
  contentWithMobileSave: {
    "@media (max-width: 559px)": {
      paddingBottom: "calc(72px + env(safe-area-inset-bottom))",
    },
  },
  contentWithMobileSaveHint: {
    "@media (max-width: 559px)": {
      paddingBottom: "calc(104px + env(safe-area-inset-bottom))",
    },
  },
  mobileSaveBar: {
    display: "none",
    "@media (max-width: 559px)": {
      position: "fixed",
      zIndex: zIndices.sticky,
      right: 0,
      bottom: 0,
      left: 0,
      display: "block",
      paddingBottom: "env(safe-area-inset-bottom)",
      backgroundColor: colors.ground,
    },
  },
  mobileSaveInner: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    maxWidth: "760px",
    flexDirection: "column",
    rowGap: space.x2,
    marginRight: "auto",
    marginLeft: "auto",
    paddingTop: space.x3,
    paddingRight: `max(${space.x3}, env(safe-area-inset-right))`,
    paddingBottom: space.x3,
    paddingLeft: `max(${space.x3}, env(safe-area-inset-left))`,
  },
  mobileActions: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
    gap: space.x2,
  },
  singleMobileAction: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  saveHint: {
    margin: 0,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
