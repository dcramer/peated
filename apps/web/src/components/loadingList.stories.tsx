import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LoadingList } from "./feedback.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Messages & Status/Loading List",
  component: LoadingList,
  args: { rows: 3 },
  argTypes: {
    rows: { control: "inline-radio", options: [1, 2, 3, 4] },
    variant: {
      control: "inline-radio",
      options: ["standard", "bottleAction", "sidebar", "text"],
    },
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

export const Variants: Story = {
  render: () => (
    <StoryStack>
      <LoadingList label="Loading bottles" rows={1} />
      <LoadingList
        label="Loading bottles with actions"
        rows={1}
        variant="bottleAction"
      />
      <LoadingList label="Loading sidebar records" rows={1} variant="sidebar" />
      <LoadingList label="Loading text records" rows={1} variant="text" />
    </StoryStack>
  ),
};
