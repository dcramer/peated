import { mockCollectionBottles } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getLibraryItem } from "../lib/libraryItems";
import { LibraryTable, LibraryTableLoading } from "./libraryTable.stylex";
import type { RowMenuGroup } from "./rowMenu.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const ownerActions: RowMenuGroup[] = [
  { items: [{ href: "#", label: "Rate this bottle" }] },
  {
    label: "Bottle status",
    items: [
      { label: "Mark as open", onSelect: () => {} },
      { label: "Mark as sealed", onSelect: () => {} },
      { label: "Mark as empty", onSelect: () => {} },
      { label: "Clear status", onSelect: () => {} },
    ],
  },
  { items: [{ label: "Remove from library", onSelect: () => {} }] },
];

const meta = {
  title: "Components/Bottles/Library Table",
  component: LibraryTable,
  parameters: {
    docs: {
      description: {
        component:
          "Dense table of one member's Library, the compact alternative to Library List on the Library tab. Each row links to its Bottle. It shows a compact bottle identity with its producers and release facts on one line, the status, and the ABV; the owner also gets a row menu. Narrow screens hide the ABV column. Map API entries with getLibraryItem.",
      },
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    caption: "dcramer's library",
    items: mockCollectionBottles.map((entry) =>
      getLibraryItem(entry, ownerActions),
    ),
  },
} satisfies Meta<typeof LibraryTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Visitor: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Another member's Library: no row menus, so the actions column is left out.",
      },
    },
  },
  args: {
    items: mockCollectionBottles.map((entry) => getLibraryItem(entry)),
  },
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Reserves the columns and two-line rows while the Library loads, with the owner's actions column. Compare it with Overview.",
      },
    },
  },
  render: () => <LibraryTableLoading actions rows={4} />,
};
