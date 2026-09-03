import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CriticReview } from "./criticReview.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Reviews & Tastings/Critic Review",
  component: CriticReview,
  args: {
    href: "#review",
    publication: "Whisky Advocate",
    publishedAt: "14 Mar 2025",
    nativeScore: { value: 92, scale: 100 },
    reviewerName: "Jonny McCormick",
    summary:
      "Dense smoke gives way to dark fruit, salted caramel, and a dry finish.",
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof CriticReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <ItemList ariaLabel="Critic review examples">
      <ItemListItem>
        <CriticReview {...args} />
      </ItemListItem>
      <ItemListItem>
        <CriticReview
          publication="Malt Review"
          publishedAt="2 Sep 2024"
          nativeScore={{ value: 8, scale: 10 }}
        />
      </ItemListItem>
      <ItemListItem>
        <CriticReview publication="Whisky Notes" nativeScore={null} />
      </ItemListItem>
    </ItemList>
  ),
};
