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
  },
};

export const Private: Story = {
  args: {
    actions: <Button variant="accent">Add friend</Button>,
    privateProfile: true,
  },
};
