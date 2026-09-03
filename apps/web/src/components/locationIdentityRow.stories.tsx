import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { LocationIdentityRow } from "./locationIdentityRow.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";
const meta = {
  title: "Components/Catalog/Location Identity Row",
  component: LocationIdentityRow,
  args: {
    name: "Islay",
    country: "Scotland",
    href: "/locations/scotland/regions/islay",
  },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof LocationIdentityRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {
  render: (args) => (
    <ItemList ariaLabel="Locations">
      <ItemListItem>
        <LocationIdentityRow {...args} />
      </ItemListItem>
      <ItemListItem>
        <LocationIdentityRow name="Scotland" href="/locations/scotland" />
      </ItemListItem>
    </ItemList>
  ),
};
