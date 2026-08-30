"use client";

import * as stylex from "@stylexjs/stylex";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

import {
  Button,
  IconButton,
  LoadingList,
} from "@peated/web/components/designSystem/components";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, controlMetrics, fonts, space } from "../styles/tokens.stylex";

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
        )}
      >
        {children}
      </div>
      {onSave && mobileSaveBar ? (
        <div {...stylex.props(styles.mobileSaveBar)}>
          <div {...stylex.props(styles.mobileSaveInner)}>
            {saveHint ? (
              <p {...stylex.props(styles.saveHint)}>{saveHint}</p>
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
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
  mobileHeaderSave: {
    "@media (max-width: 559px)": { display: "none" },
  },
  contentWithMobileSave: {
    "@media (max-width: 559px)": {
      paddingBottom: "calc(104px + env(safe-area-inset-bottom))",
    },
  },
  mobileSaveBar: {
    display: "none",
    "@media (max-width: 559px)": {
      position: "fixed",
      zIndex: 20,
      right: 0,
      bottom: 0,
      left: 0,
      display: "block",
      paddingBottom: "env(safe-area-inset-bottom)",
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: colors.hairline,
      backgroundColor: colors.surface,
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
    paddingRight: space.x3,
    paddingBottom: space.x3,
    paddingLeft: space.x3,
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
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
    textAlign: "center",
  },
});
