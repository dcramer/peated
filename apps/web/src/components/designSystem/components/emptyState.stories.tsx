import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { Button } from "./button.stylex";
import { CountChip } from "./chip.stylex";
import { EmptyState } from "./feedback.stylex";
import { RailList, RailListItem } from "./lists.stylex";

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

export const Overview: Story = {
  args: { children: null, heading: null },
  render: () => (
    <StoryStack>
      <EmptyState
        action={<Button variant="accent">Add this bottle</Button>}
        heading="No matches"
        status={<CountChip count={0} tone="neutral" />}
        supplementary={
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
        }
      >
        No bottles match “Ardbeg Traigh Bhan 20”. Check the spelling or add it
        to the database.
      </EmptyState>
      <EmptyState
        action={<Button variant="accent">Browse bottles</Button>}
        heading="No bottles yet"
      >
        Your Library is empty. Add your first bottle when you want to keep track
        of it here.
      </EmptyState>
    </StoryStack>
  ),
};
