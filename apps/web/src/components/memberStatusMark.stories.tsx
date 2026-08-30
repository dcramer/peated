import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MemberStatusMark } from "./memberStatusMark.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Data Display/Member Status Mark",
  component: MemberStatusMark,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  args: { kind: "following" },
} satisfies Meta<typeof MemberStatusMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <span>
        Ardbeg
        <MemberStatusMark kind="following" />
      </span>
      <span>
        Uigeadail
        <MemberStatusMark kind="library" />
      </span>
      <span>
        Corryvreckan
        <MemberStatusMark kind="tasted" />
      </span>
    </StoryStack>
  ),
};
