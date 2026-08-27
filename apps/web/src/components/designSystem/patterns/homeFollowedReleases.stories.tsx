import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import { HomeFollowedReleases } from "./homeDiscovery.stylex";

const meta = {
  title: "Patterns/Home/Followed Releases",
  component: HomeFollowedReleases,
  args: {
    followedDistillerCount: 14,
    releases: [
      {
        bottleHref: "#port-charlotte",
        bottleName: "Port Charlotte MRC:02",
        distiller: "Bruichladdich",
        metadata: ["2026 release", "59.2% ABV"],
      },
      {
        bottleHref: "#springbank",
        bottleName: "Local Barley 2026",
        distiller: "Springbank",
        metadata: ["11 years", "55.8% ABV"],
      },
      {
        bottleHref: "#loch-gorm",
        bottleName: "Loch Gorm 2026",
        distiller: "Kilchoman",
        metadata: ["10 years", "46.0% ABV"],
      },
    ],
    seeAllHref: "#all-releases",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof HomeFollowedReleases>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecentReleases: Story = {};

export const OneDistiller: Story = {
  args: {
    followedDistillerCount: 1,
    releases: [meta.args.releases[0]],
  },
};
