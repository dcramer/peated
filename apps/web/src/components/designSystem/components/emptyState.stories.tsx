import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { Button } from "./button.stylex";
import { CountChip } from "./chip.stylex";
import { EmptyState } from "./feedback.stylex";
import { RailList, RailListItem } from "./listStructures.stylex";

const meta = {
  title: "Components/Feedback/Empty State",
  component: EmptyState,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchResults: Story = {
  args: {
    action: <Button variant="accent">Record this bottle</Button>,
    children:
      "No bottles match “Ardbeg Traigh Bhan 20”. Check the spelling or add it to the database.",
    heading: "No matches",
    status: <CountChip count={0} tone="neutral" />,
    supplementary: (
      <RailList ariaLabel="Nearby matches">
        <RailListItem
          metadata="Islay · 46.2% ABV"
          title="Ardbeg Traigh Bhan 19 Year Old"
        />
        <RailListItem
          metadata="Islay · 46.2% ABV"
          title="Ardbeg Traigh Bhan 18 Year Old"
        />
      </RailList>
    ),
  },
};

export const Library: Story = {
  args: {
    action: <Button variant="accent">Browse bottles</Button>,
    children:
      "Your library is empty. Add a bottle when you want to keep track of it here.",
    heading: "No bottles yet",
  },
};
