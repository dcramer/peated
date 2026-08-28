import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TextLink } from "../patterns/pagePatternShell.stylex";
import { StoryCanvas } from "../storyFixtures.stylex";
import { DataTable, type DataTableColumn } from "./dataTable.stylex";

type LocationRow = {
  bottles: number;
  distillers: number;
  name: string;
  slug: string;
};

const rows = [
  { bottles: 18_420, distillers: 142, name: "Scotland", slug: "scotland" },
  {
    bottles: 4_182,
    distillers: 86,
    name: "United States",
    slug: "united-states",
  },
  { bottles: 2_813, distillers: 34, name: "Japan", slug: "japan" },
] satisfies LocationRow[];

const columns: DataTableColumn<LocationRow>[] = [
  {
    cell: (item) => <TextLink href={`#${item.slug}`}>{item.name}</TextLink>,
    header: "Location",
    key: "name",
  },
  {
    align: "right",
    cell: (item) => item.bottles.toLocaleString("en-US"),
    header: "Bottles",
    key: "bottles",
    priority: "secondary",
  },
  {
    align: "right",
    cell: (item) => item.distillers.toLocaleString("en-US"),
    header: "Distillers",
    key: "distillers",
    priority: "secondary",
  },
];

const meta = {
  title: "Components/Data Display/Table",
  component: DataTable,
  args: {
    caption: "Whisky locations",
    columns,
    getKey: (item: LocationRow) => item.slug,
    items: rows,
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof DataTable<LocationRow>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
