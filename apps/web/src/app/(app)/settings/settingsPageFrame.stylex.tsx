"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  FormSection,
  FormStack,
  LoadingList,
  LoadingPlaceholder,
} from "@peated/web/components";
import {
  PageHeader,
  TabbedPage,
} from "@peated/web/components/pages/pageLayout.stylex";
import { colors, controlMetrics, space } from "../../../styles/tokens.stylex";

const tabs = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
] as const;

export function SettingsPageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div {...stylex.props(styles.page)}>
      <TabbedPage
        currentHref={pathname}
        header={
          <PageHeader
            description="Manage how your account appears and how you sign in."
            title="Settings"
          />
        }
        tabs={tabs}
        tabsLabel="Account settings"
      >
        {children}
      </TabbedPage>
    </div>
  );
}

export function SettingsContentLoading() {
  const pathname = usePathname();
  const security = pathname.endsWith("/security");

  return (
    <div aria-busy="true" aria-label="Loading settings" role="status">
      <FormStack>
        <FormSection
          description={
            security
              ? "Use a unique password with at least 8 characters."
              : "The name and picture shown beside your tastings and contributions."
          }
          title={security ? "Password" : "Profile"}
        >
          <SettingsFieldsLoading rows={security ? 2 : 3} />
          <span aria-hidden="true" {...stylex.props(styles.loadingAction)} />
        </FormSection>
        <FormSection
          description={
            security
              ? "Sign in with your fingerprint, face, or device PIN."
              : "Choose who can see your tasting activity."
          }
          title={security ? "Passkeys" : "Privacy"}
        >
          {security ? (
            <LoadingList label="Loading passkeys" rows={2} variant="text" />
          ) : (
            <div aria-hidden="true" {...stylex.props(styles.loadingSwitch)}>
              <span {...stylex.props(styles.loadingSwitchControl)} />
              <span {...stylex.props(styles.loadingSwitchCopy)}>
                <LoadingPlaceholder preset="text" />
                <LoadingPlaceholder preset="metadata" />
              </span>
            </div>
          )}
        </FormSection>
      </FormStack>
    </div>
  );
}

function SettingsFieldsLoading({ rows }: { rows: 2 | 3 }) {
  return (
    <div {...stylex.props(styles.loadingFields)}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          aria-hidden="true"
          key={index}
          {...stylex.props(styles.loadingField)}
        >
          <LoadingPlaceholder
            delay={index === 0 ? 0 : index === 1 ? 1 : 2}
            preset="metadata"
          />
          <span {...stylex.props(styles.loadingControl)} />
        </div>
      ))}
    </div>
  );
}

const styles = stylex.create({
  page: {
    width: "100%",
    maxWidth: "760px",
    minWidth: 0,
  },
  loadingFields: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
  },
  loadingField: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
  },
  loadingControl: {
    display: "block",
    width: "100%",
    height: controlMetrics.controlHeightLarge,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingAction: {
    display: "block",
    width: "116px",
    height: controlMetrics.controlHeight,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingSwitch: {
    display: "flex",
    minHeight: "44px",
    alignItems: "flex-start",
    gap: space.x3,
  },
  loadingSwitchControl: {
    display: "block",
    width: "38px",
    height: "22px",
    flexShrink: 0,
    borderRadius: "999px",
    backgroundColor: colors.surface,
  },
  loadingSwitchCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: space.x1,
  },
});
