import { mockCollectionBottles } from "@peated/server/orpc/mock/fixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getLibraryItem } from "../lib/libraryItems";
import { LibraryList, LibraryListLoading } from "./libraryList.stylex";
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
  title: "Components/Bottles/Library List",
  component: LibraryList,
  parameters: {
    docs: {
      description: {
        component:
          "One member's Library Bottles as standard bottle rows. Each row shows its status, and the owner gets a row menu to rate, change the status, or remove the Bottle. Rows leave out the viewer's in-Library and tasted marks. Library Table is the dense alternative. Map API entries with getLibraryItem.",
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
    ariaLabel: "dcramer's library",
    items: mockCollectionBottles.map((entry) =>
      getLibraryItem(entry, ownerActions),
    ),
  },
} satisfies Meta<typeof LibraryList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Visitor: Story = {
  parameters: {
    docs: {
      description: {
        story: "Another member's Library: statuses without a row menu.",
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
          "Reserves rows at their finished size while the Library loads. Compare it with Overview.",
      },
    },
  },
  render: () => <LibraryListLoading rows={4} />,
};
