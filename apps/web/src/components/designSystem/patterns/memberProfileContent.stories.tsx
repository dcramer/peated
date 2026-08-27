import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  MemberActivityList,
  MemberLibraryFilters,
  MemberLibraryList,
} from "./memberProfileContent.stylex";

const meta = {
  title: "Patterns/Profile/Member Content",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const libraryItems = [
  {
    actions: [
      {
        items: [
          { href: "/bottles/1/addTasting", label: "Record a tasting" },
          { label: "Mark as open", onSelect: () => undefined },
        ],
      },
      {
        items: [{ label: "Remove from library", onSelect: () => undefined }],
      },
    ],
    brand: "Lagavulin",
    href: "/bottles/1",
    id: "B0001",
    metadata: ["Islay", "16 years", "43% ABV"],
    name: "16-year-old",
    status: "Open",
  },
  {
    brand: "Springbank",
    href: "/bottles/2",
    id: "B0002",
    metadata: ["Campbeltown", "10 years", "46% ABV"],
    name: "10-year-old",
    status: "Sealed",
  },
] as const;

export const Library: Story = {
  render: () => (
    <div style={{ maxWidth: 820 }}>
      <MemberLibraryList
        emptyDescription="No bottles have been recorded."
        emptyHeading="No library bottles yet"
        items={libraryItems}
        page={1}
        total={20}
      />
    </div>
  ),
};

export const LibraryFilters: Story = {
  render: () => (
    <div style={{ maxWidth: 336 }}>
      <MemberLibraryFilters
        groups={[
          {
            filters: [
              { count: 7, label: "Open", selected: true, value: "open" },
              { count: 13, label: "Sealed", selected: false, value: "sealed" },
            ],
            label: "Status",
            name: "status",
          },
          {
            filters: [
              { count: 5, label: "Lagavulin", selected: false, value: "1" },
              { count: 3, label: "Springbank", selected: false, value: "2" },
            ],
            label: "Brands",
            name: "brand",
          },
        ]}
        mode="rail"
        onChange={() => undefined}
        onClear={() => undefined}
        onQuerySubmit={() => undefined}
        query=""
        total={20}
      />
    </div>
  ),
};

export const Activity: Story = {
  render: () => (
    <div style={{ maxWidth: 820 }}>
      <MemberActivityList
        emptyDescription="Recorded activity will appear here."
        items={[
          {
            id: "tasting-1",
            kind: "tasting",
            tasting: {
              author: "islay-dreamer",
              authorHref: "/users/islay-dreamer",
              date: "3 days ago",
              members: [
                {
                  description: "Coastal smoke, wax, and lemon oil.",
                  href: "/bottles/1",
                  metadata: "Single malt · 16 years · 43% ABV",
                  name: "Lagavulin 16-year-old",
                  verdict: "savor",
                },
              ],
            },
          },
          {
            activity: {
              author: "islay-dreamer",
              authorHref: "/users/islay-dreamer",
              collectionHref: "/users/islay-dreamer/library",
              collectionName: "Library",
              date: "1 week ago",
              id: "collection-1",
              items: libraryItems.map(
                ({ brand, href, id, metadata, name }) => ({
                  brand,
                  href,
                  id,
                  metadata,
                  name,
                }),
              ),
              totalItems: 3,
            },
            id: "collection-1",
            kind: "collection",
          },
        ]}
      />
    </div>
  ),
};

export const EmptyLibrary: Story = {
  render: () => (
    <div style={{ maxWidth: 820 }}>
      <MemberLibraryList
        emptyDescription="This member has not recorded any library bottles."
        emptyHeading="No library bottles yet"
        items={[]}
        page={1}
      />
    </div>
  ),
};
