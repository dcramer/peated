import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SeriesIdentityRow } from "./seriesIdentityRow.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";
const meta = {
  title: "Components/Catalog/Series Identity Row",
  component: SeriesIdentityRow,
  args: { name: "Elements", brand: "Laphroaig", href: "/series/1" },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof SeriesIdentityRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
