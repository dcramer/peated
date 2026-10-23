import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../../components/storyFixtures.stylex";
import { broraAbout } from "./articles/brora";
import { getVintageCounts } from "./entityAbout";
import { VintageChart } from "./vintageChart.stylex";

const broraVintages = getVintageCounts(
  Object.entries({
    1965: 1,
    1970: 2,
    1971: 6,
    1972: 25,
    1974: 5,
    1975: 6,
    1976: 4,
    1977: 16,
    1978: 15,
    1979: 1,
    1980: 6,
    1981: 78,
    1982: 69,
    1983: 7,
  })
    .flatMap(([year, count]): { vintageYear: number | null }[] =>
      Array.from({ length: count }, () => ({ vintageYear: Number(year) })),
    )
    .concat(Array.from({ length: 14 }, () => ({ vintageYear: null }))),
);

const meta = {
  title: "Components/History/Vintage Chart",
  component: VintageChart,
  args: {
    ...broraVintages,
    highlight: broraAbout.peatedYears,
    names: broraAbout.names,
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

/** Brora's catalog in October 2026. Hover a bar for its exact count. */
export const Overview: Story = {};
