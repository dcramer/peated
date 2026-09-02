import { mockFlavorProfile as profile } from "@peated/server/orpc/mock/fixtures/flavorProfile";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FlavorWheel } from "./flavorWheel.stylex";
import { RailSection } from "./pages/pageLayout.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Data/Flavor Wheel",
  component: FlavorWheel,
  args: { profile },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <RailSection heading="Flavor profile">
          <Story />
        </RailSection>
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof FlavorWheel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
export const Sparse: Story = {
  args: {
    profile: {
      totalBottles: 40,
      notedBottles: 2,
      categories: [
        {
          category: "smoke",
          bottleCount: 2,
          notes: [
            { name: "brine", bottleCount: 1 },
            { name: "ash", bottleCount: 1 },
          ],
        },
      ],
    },
  },
};
export const Empty: Story = {
  args: { profile: { totalBottles: 40, notedBottles: 0, categories: [] } },
};
