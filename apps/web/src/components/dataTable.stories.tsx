import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataTable, type DataTableColumn } from "./dataTable.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";
import { TextLink } from "./textLink.stylex";

type LocationRow = {
  bottles: number;
  distillers: number;
  name: string;
  region: string;
  regionSlug: string;
  slug: string;
};

const rows = [
  {
    bottles: 18_420,
    distillers: 142,
    name: "Scotland",
    region: "Islay",
    regionSlug: "islay",
    slug: "scotland",
  },
  {
    bottles: 4_182,
    distillers: 86,
    name: "United States",
    region: "Kentucky",
    regionSlug: "kentucky",
    slug: "united-states",
  },
  {
    bottles: 2_813,
    distillers: 34,
    name: "Japan",
    region: "Hokkaido",
    regionSlug: "hokkaido",
    slug: "japan",
  },
] satisfies LocationRow[];

const interactionRows = [
  { ...rows[0], name: "Default", slug: "default" },
  { ...rows[0], name: "Hovered", slug: "hovered" },
  { ...rows[0], name: "Keyboard focused", slug: "focused" },
  {
    ...rows[0],
    name: "Primary row with a nested link",
    region: "Publication link",
    regionSlug: "publication",
    slug: "nested",
  },
  { ...rows[0], name: "Pressed", slug: "pressed" },
] satisfies LocationRow[];

const columns: DataTableColumn<LocationRow>[] = [
  {
    cell: (item) => item.name,
    header: "Location",
    key: "name",
  },
  {
    cell: (item) => (
      <TextLink href={`#${item.regionSlug}`}>{item.region}</TextLink>
    ),
    header: "Region",
    key: "region",
    priority: "secondary",
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

const interactionColumns: DataTableColumn<LocationRow>[] = [
  columns[0]!,
  { ...columns[1]!, priority: undefined },
];

const meta = {
  title: "Components/Data Display/Table",
  component: DataTable,
  args: {
    caption: "Whisky locations",
    columns,
    getHref: (item: LocationRow) => `#${item.slug}`,
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

export const InteractionStates: Story = {
  render: () => (
    <DataTable
      caption="Linked table interaction states"
      columns={interactionColumns}
      getHref={(item) => `#${item.slug}`}
      getKey={(item) => item.slug}
      items={interactionRows}
    />
  ),
  parameters: {
    pseudo: {
      active: ['tr[data-record-key="pressed"]'],
      focusWithin: ['tr[data-record-key="focused"]'],
      hover: ['tr[data-record-key="hovered"]'],
    },
  },
};
