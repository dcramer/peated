import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink } from "../components";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  PageState,
  PageStateReference,
  PageStateSupport,
} from "./pageState.stylex";

const reportAction = (
  <ButtonLink
    href="https://github.com/peated/peated/issues/new"
    size="sm"
    variant="text"
  >
    Report a bug →
  </ButtonLink>
);

function NotFoundState() {
  return (
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
        <PageStateSupport action={reportAction}>
          Something wrong here that we should know about?
        </PageStateSupport>
      }
      title="Nothing lives here"
    >
      This address does not match anything in the database. Search for the
      record, or add the bottling if it is genuinely missing.
    </PageState>
  );
}

function ForbiddenState() {
  return (
    <PageState
      actions={
        <>
          <Button onClick={() => undefined}>Go back</Button>
          <ButtonLink href="/bottles" variant="tonal">
            Browse the database
          </ButtonLink>
        </>
      }
      detail={
        <PageStateReference
          description="A refused request is not an application failure, so it has no Sentry reference."
          label="Route"
          value="POST /bottles/B00872/merge · 403"
        />
      }
      status="403 · no permission"
      support={
        <PageStateSupport action={reportAction}>
          Think this account should have access?
        </PageStateSupport>
      }
      title="You do not have permission for this"
    >
      Your account cannot perform this action. Nothing has changed, and the rest
      of the database remains available.
    </PageState>
  );
}

function FailureState() {
  return (
    <PageState
      actions={
        <>
          <Button onClick={() => undefined}>Try again</Button>
          <ButtonLink href="/bottles/872" variant="tonal">
            Back to the bottle
          </ButtonLink>
          <ButtonLink
            href="https://github.com/peated/peated/issues/new"
            variant="tonal"
          >
            Report a bug
          </ButtonLink>
        </>
      }
      detail={
        <PageStateReference
          action={
            <Button onClick={() => undefined} size="sm" variant="text">
              Copy
            </Button>
          }
          description="Quote this reference when reporting the problem. It identifies the captured failure without exposing account or request data."
          label="Sentry ID"
          technicalDetail={{
            context:
              "GET /bottles/[id] · 500 · web@2026.8.26 · 2026-08-26T05:14:08Z",
            defaultOpen: true,
            stack: `TypeError: Cannot read properties of undefined
    at BottlePage (app/bottles/[id]/page.tsx:118:24)
    at renderToPipeableStream (react-dom-server.js:5218:22)
    at appRender (next/server/app-render.js:1180:31)`,
          }}
          value="8f3a21c47b9e4d10a2f6b3c4d5e60718"
        />
      }
      status="500 · our fault"
      title="This page broke on our side"
    >
      Nothing you did caused this, and nothing you recorded is affected. The
      failure was reported automatically.
    </PageState>
  );
}

function OfflineState() {
  return (
    <PageState
      actions={<Button onClick={() => undefined}>Try again</Button>}
      status="Offline"
      title="Peated cannot reach the database"
    >
      Search and bottle pages need a connection. Check your signal and try again
      when the database is reachable.
    </PageState>
  );
}

const meta = {
  title: "Patterns/Page State",
  component: PageState,
  args: {
    children: null,
    status: "",
    title: "",
  },
  argTypes: {
    actions: { control: false },
    children: { control: false },
    detail: { control: false },
    status: { control: false },
    support: { control: false },
    title: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof PageState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotFound: Story = { render: () => <NotFoundState /> };

export const Forbidden: Story = { render: () => <ForbiddenState /> };

export const PageFailure: Story = { render: () => <FailureState /> };

export const Offline: Story = { render: () => <OfflineState /> };
