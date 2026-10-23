import { StoryCanvas } from "@peated/web/components/storyFixtures.stylex";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BottleAuctionList } from "./bottleAuctionList.stylex";

const lot = {
  id: 1,
  bottleId: 1,
  auction: {
    id: 1,
    name: "September auction",
    url: "https://example.com/auction",
    site: { name: "Example Whisky Auctions", type: "example" },
  },
  lotNumber: "183-3264",
  name: "Example 12 Year Old",
  url: "https://example.com/lot",
  volume: 700,
  condition: null,
  state: "live" as const,
  availability: "live" as const,
  endsAt: "2026-10-10T19:00:00Z",
  currentBid: 9000,
  bidCurrency: "gbp" as const,
  lastCheckedAt: "2026-09-30T12:00:00Z",
  result: null,
};
const meta = {
  title: "Bottles/Auctions",
  component: BottleAuctionList,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    lots: [
      lot,
      {
        ...lot,
        id: 2,
        state: "closed",
        availability: "unavailable",
        result: {
          id: 1,
          outcome: "sold",
          amount: 12000,
          currency: "gbp",
          priceKind: "hammer",
          soldAt: null,
          observedAt: lot.lastCheckedAt,
          priceNote: null,
        },
      },
      { ...lot, id: 3, availability: "unknown" },
      { ...lot, id: 4, state: "closed", availability: "unavailable" },
    ],
  },
} satisfies Meta<typeof BottleAuctionList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
