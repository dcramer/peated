import * as stylex from "@stylexjs/stylex";
import { Copy } from "lucide-react";
import type { ReactNode } from "react";

import config from "../../../config";
import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors } from "../../../styles/tokens.stylex";
import { Button, ButtonLink, IconButton } from "../components/button.stylex";
import {
  ErrorPage,
  ErrorPageLayout,
  ErrorReference,
  ErrorSupport,
} from "../patterns/errorPage.stylex";

const issueUrl = `${config.GITHUB_REPO}/issues/new`;

function ReportAction() {
  return (
    <ButtonLink href={issueUrl} size="sm" variant="text">
      Report a bug →
    </ButtonLink>
  );
}

export function ErrorDocument({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <html
      lang="en"
      {...stylex.props(foundationStyles.document, styles.document)}
    >
      {/* The global recovery documents replace the root layout and own their head. */}
      {/* oxlint-disable-next-line next/no-head-element */}
      <head>
        <title>{title}</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
      </head>
      <body {...stylex.props(styles.body)}>{children}</body>
    </html>
  );
}

export function NotFoundPage({ document = false }: { document?: boolean }) {
  const content = (
    <ErrorPage
      actions={
        <>
          <ButtonLink href="/search">Search the database</ButtonLink>
          <ButtonLink href="/addBottle" variant="tonal">
            Record a bottle
          </ButtonLink>
        </>
      }
      status="404 · nothing at this address"
      support={
        <ErrorSupport action={<ReportAction />}>
          Something wrong here that we should know about?
        </ErrorSupport>
      }
      title="Nothing lives here"
    >
      This address does not match anything in the database. Search for the
      record, or add the bottling if it is genuinely missing.
    </ErrorPage>
  );

  const page = <ErrorPageLayout>{content}</ErrorPageLayout>;
  return document ? (
    <ErrorDocument title="Not found | Peated">{page}</ErrorDocument>
  ) : (
    page
  );
}

export function ForbiddenPage({ route }: { route?: string }) {
  return (
    <ErrorPageLayout>
      <ErrorPage
        actions={
          <>
            <ButtonLink href="/">Go home</ButtonLink>
            <ButtonLink href="/bottles" variant="tonal">
              Browse the database
            </ButtonLink>
          </>
        }
        detail={
          route ? (
            <ErrorReference
              description="A refused request is not an application failure, so it has no Sentry reference."
              label="Route"
              value={`${route} · 403`}
            />
          ) : undefined
        }
        status="403 · no permission"
        support={
          <ErrorSupport action={<ReportAction />}>
            Think this account should have access?
          </ErrorSupport>
        }
        title="You do not have permission for this"
      >
        Your account cannot perform this action. Nothing has changed, and the
        rest of the database remains available.
      </ErrorPage>
    </ErrorPageLayout>
  );
}

export function OfflinePage({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorPageLayout>
      <ErrorPage
        actions={<Button onClick={onRetry}>Try again</Button>}
        status="Offline"
        title="Peated cannot reach the database"
      >
        Search and bottle pages need a connection. Check your signal and try
        again when the database is reachable.
      </ErrorPage>
    </ErrorPageLayout>
  );
}

export function CapturedFailurePage({
  incidentReference,
  onCopyReference,
  onRetry,
  stack,
}: {
  incidentReference?: string;
  onCopyReference?: () => void;
  onRetry: () => void;
  stack?: string;
}) {
  return (
    <ErrorPageLayout>
      <ErrorPage
        actions={
          <>
            <Button onClick={onRetry}>Try again</Button>
            <ButtonLink href="/" variant="tonal">
              Go home
            </ButtonLink>
            <ButtonLink href={issueUrl} variant="tonal">
              Report a bug
            </ButtonLink>
          </>
        }
        detail={
          incidentReference ? (
            <ErrorReference
              action={
                onCopyReference ? (
                  <IconButton
                    icon={
                      <Copy aria-hidden="true" size={15} strokeWidth={1.75} />
                    }
                    label="Copy error reference"
                    onClick={onCopyReference}
                    size="sm"
                    title="Copy error reference"
                    variant="text"
                  />
                ) : undefined
              }
              description="Use this reference when reporting the problem."
              label="Sentry event ID"
              technicalDetail={stack ? { stack } : undefined}
              value={incidentReference}
            />
          ) : undefined
        }
        status="500 · our fault"
        title="This page broke on our side"
      >
        Nothing you did caused this, and nothing you recorded is affected. The
        failure was reported automatically.
      </ErrorPage>
    </ErrorPageLayout>
  );
}

const styles = stylex.create({
  document: {
    minHeight: "100dvh",
    backgroundColor: colors.ground,
  },
  body: {
    minHeight: "100dvh",
    margin: 0,
    backgroundColor: colors.ground,
  },
});
