import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  mockBrora,
  mockEntityAbouts,
  mockEntityVintageCounts,
} from "@peated/server/orpc/mock/fixtures";
import { StoryCanvas } from "../../components/storyFixtures.stylex";

import { fillYears, getEras, getNameSpans } from "./entityAbout";
import { VintageChart } from "./vintageChart.stylex";

const broraAbout = mockEntityAbouts.get(mockBrora.id)!;
const broraVintages = mockEntityVintageCounts.get(mockBrora.id)!;

const meta = {
  title: "Components/History/Vintage Chart",
  component: VintageChart,
  args: {
    years: fillYears(broraVintages),
    withoutVintage: broraVintages.withoutYear,
    eras: getEras(broraAbout),
    names: getNameSpans(broraAbout, mockBrora.name),
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof VintageChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Brora's mock catalog. Hover a bar for its exact count. */
export const Overview: Story = {};
