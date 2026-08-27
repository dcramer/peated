import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink } from "../components";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  MemberProfileHeader,
  type MemberProfileHeaderProps,
} from "./memberProfileHeader.stylex";

const meta = {
  title: "Patterns/Profile/Member Header",
  component: MemberProfileHeader,
  args: {
    ratings: { pass: 15, savor: 69, sip: 44 },
    username: "dcramer",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<MemberProfileHeaderProps>;

export default meta;
type Story = StoryObj<MemberProfileHeaderProps>;

export const AnotherMember: Story = {
  args: {
    actions: <Button variant="accent">Add friend</Button>,
    ratingLabel: "How they rate",
  },
};

export const YourProfile: Story = {
  args: {
    actions: (
      <>
        <ButtonLink href="/settings/profile" variant="tonal">
          Edit profile
        </ButtonLink>
        <ButtonLink href="/settings" variant="tonal">
          Settings
        </ButtonLink>
      </>
    ),
    metadata: ["Joined August 2026"],
    ratingLabel: "How you rate",
  },
};

export const Private: Story = {
  args: {
    actions: <Button variant="accent">Add friend</Button>,
    privateProfile: true,
    ratings: undefined,
  },
};

export const RatingLoading: Story = {
  args: {
    actions: <Button variant="accent">Add friend</Button>,
    ratings: undefined,
    ratingsLoading: true,
  },
};
