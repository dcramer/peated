import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { DuplicateMatchList } from "./duplicateMatchList.stylex";

const meta = {
  title: "Components/Feedback/Duplicate Match List",
  component: DuplicateMatchList,
  args: {
    matches: [
      {
        id: "B31204",
        metadata: "2022 release · 59.2% ABV",
        name: "Port Charlotte MRC:01",
      },
      {
        id: "B44117",
        metadata: "2023 release · 59.2% ABV",
        name: "Port Charlotte MRC:01 2023",
      },
    ],
    onSelect: () => undefined,
  },
  argTypes: {
    matches: { control: false },
    onSelect: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof DuplicateMatchList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
