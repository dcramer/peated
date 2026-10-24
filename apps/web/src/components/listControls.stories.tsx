import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { TextInput } from "./field.stylex";
import { FacetGroup } from "./filterPanel.stylex";
import { ListControls } from "./listControls.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const sortOptions = [
  { label: "Newest", value: "-created" },
  { label: "Best rated", value: "-rating" },
] as const;

const meta = {
  title: "Components/Lists & Tables/List Controls",
  component: ListControls,
  parameters: {
    docs: {
      description: {
        component:
          "The narrow-screen Filters button and its drawer with search, sort, and filters. Pass it to ListToolbar as `mobileAction`; the toolbar shows it where the page's filter rail collapses. The button counts active filters, and the drawer footer clears them.",
      },
    },
  },
  args: {
    activeFilterCount: 0,
    onSortChange: () => undefined,
    pluralNoun: "tastings",
    sort: "-created",
    sortOptions,
  },
  argTypes: {
    filters: { control: false },
    onClear: { control: false },
    onSortChange: { control: false },
    search: { control: false },
    sortOptions: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof ListControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open the drawer to see search, sort, and a facet group together. */
export const Overview: Story = {
  render: function Overview(args) {
    const [rating, setRating] = useState("unicorn");
    const [sort, setSort] = useState(args.sort);

    return (
      <ListControls
        {...args}
        activeFilterCount={rating ? 1 : 0}
        filters={
          <FacetGroup
            label="Rating"
            onChange={setRating}
            options={[
              { count: 11, label: "Unicorn · 95–100", value: "unicorn" },
              { count: 42, label: "Outstanding · 90–94", value: "outstanding" },
              { count: 111, label: "Very good · 85–89", value: "very_good" },
            ]}
            selected={rating}
            total={290}
          />
        }
        onClear={() => setRating("")}
        onSortChange={setSort}
        search={
          <TextInput
            aria-label="Find in these tastings"
            placeholder="Brand or bottle"
          />
        }
        sort={sort}
      />
    );
  },
};
