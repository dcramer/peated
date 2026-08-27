import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { LoadingRecordList } from "./feedback.stylex";

const meta = {
  title: "Components/Feedback/Loading Record List",
  component: LoadingRecordList,
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
} satisfies Meta<typeof LoadingRecordList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleRow: Story = { args: { rows: 1 } };
