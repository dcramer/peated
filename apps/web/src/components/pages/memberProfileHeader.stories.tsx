import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink } from "..";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  MemberProfileHeader,
  type MemberProfileHeaderProps,
} from "./memberProfileHeader.stylex";

const meta = {
  title: "Components/Members/Profile Header",
  component: MemberProfileHeader,
  args: {
    bands: {
      good: 15,
      mediocre: 4,
      outstanding: 44,
      unicorn: 10,
      very_good: 31,
    },
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
    bands: undefined,
  },
};

export const RatingLoading: Story = {
  args: {
    actions: <Button variant="accent">Add friend</Button>,
    bands: undefined,
    ratingsLoading: true,
  },
};
