import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { LoadingList } from "./feedback.stylex";

const meta = {
  title: "Components/Feedback/Loading List",
  component: LoadingList,
  args: { rows: 3 },
  argTypes: {
    rows: { control: "inline-radio", options: [1, 2, 3, 4] },
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof LoadingList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <LoadingList rows={3} />
      <LoadingList rows={1} />
    </StoryStack>
  ),
};
