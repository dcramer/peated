import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AccountDeletionSection } from "./accountDeletionSection";
import { StoryCanvas } from "./storyFixtures.stylex";

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 600));

const meta = {
  title: "Components/Forms/Account Deletion Section",
  component: AccountDeletionSection,
  args: {
    username: "islaydrinker",
    deletionScheduledAt: null,
    onDelete: wait,
    onKeep: wait,
  },
  parameters: {
    docs: {
      description: {
        component:
          "The danger area in account settings. It explains what deletion removes and keeps, asks the member to type their username, and while a deletion is pending makes keeping the account the main action.",
      },
    },
  },
  render: (args) => (
    <StoryCanvas>
      <AccountDeletionSection {...args} />
    </StoryCanvas>
  ),
} satisfies Meta<typeof AccountDeletionSection>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Nothing scheduled. Delete account opens the typed confirmation. */
export const Overview: Story = {};

/** A deletion is pending; Keep my account cancels it. */
export const Pending: Story = {
  args: {
    deletionScheduledAt: new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString(),
  },
};

/** The request fails; the dialog stays open with the error. */
export const RequestFails: Story = {
  args: {
    onDelete: async () => {
      await wait();
      throw new Error(
        "Apple did not accept the authorization code. Sign in with Apple again and retry.",
      );
    },
  },
};
