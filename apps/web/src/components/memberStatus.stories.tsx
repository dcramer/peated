import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MemberStatus } from "./memberStatus.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Members/Member Status",
  component: MemberStatus,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  args: { kind: "following" },
} satisfies Meta<typeof MemberStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <span>
        Ardbeg
        <MemberStatus kind="following" />
      </span>
      <span>
        Uigeadail
        <MemberStatus kind="library" />
      </span>
      <span>
        Corryvreckan
        <MemberStatus kind="tasted" />
      </span>
    </StoryStack>
  ),
};
