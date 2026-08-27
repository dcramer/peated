import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import config from "../../../config";
import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors } from "../../../styles/tokens.stylex";
import { Button, ButtonLink } from "../components/button.stylex";
import {
  PageState,
  PageStateReference,
  PageStateShell,
  PageStateSupport,
} from "../patterns/pageState.stylex";

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
    <PageState
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
        <PageStateSupport action={<ReportAction />}>
          Something wrong here that we should know about?
        </PageStateSupport>
      }
      title="Nothing lives here"
    >
      This address does not match anything in the database. Search for the
      record, or add the bottling if it is genuinely missing.
    </PageState>
  );

  const page = <PageStateShell>{content}</PageStateShell>;
  return document ? (
    <ErrorDocument title="Not found | Peated">{page}</ErrorDocument>
  ) : (
    page
  );
}

export function ForbiddenPage({ route }: { route?: string }) {
  return (
    <PageStateShell>
      <PageState
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
            <PageStateReference
              description="A refused request is not an application failure, so it has no Sentry reference."
              label="Route"
              value={`${route} · 403`}
            />
          ) : undefined
        }
        status="403 · no permission"
        support={
          <PageStateSupport action={<ReportAction />}>
            Think this account should have access?
          </PageStateSupport>
        }
        title="You do not have permission for this"
      >
        Your account cannot perform this action. Nothing has changed, and the
        rest of the database remains available.
      </PageState>
    </PageStateShell>
  );
}

export function OfflinePage({ onRetry }: { onRetry: () => void }) {
  return (
    <PageStateShell>
      <PageState
        actions={<Button onClick={onRetry}>Try again</Button>}
        status="Offline"
        title="Peated cannot reach the database"
      >
        Search and bottle pages need a connection. Check your signal and try
        again when the database is reachable.
      </PageState>
    </PageStateShell>
  );
}

export function CapturedFailurePage({
  incidentLabel = "Error reference",
  incidentReference,
  onCopyReference,
  onRetry,
  stack,
}: {
  incidentLabel?: string;
  incidentReference?: string;
  onCopyReference?: () => void;
  onRetry: () => void;
  stack?: string;
}) {
  return (
    <PageStateShell>
      <PageState
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
          <PageStateReference
            action={
              incidentReference && onCopyReference ? (
                <Button onClick={onCopyReference} size="sm" variant="text">
                  Copy
                </Button>
              ) : undefined
            }
            description="Quote this reference when reporting the problem. It identifies the captured failure without exposing account or request data."
            label={incidentLabel}
            technicalDetail={stack ? { stack } : undefined}
            value={incidentReference ?? "Reporting…"}
          />
        }
        status="500 · our fault"
        title="This page broke on our side"
      >
        Nothing you did caused this, and nothing you recorded is affected. The
        failure was reported automatically.
      </PageState>
    </PageStateShell>
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
