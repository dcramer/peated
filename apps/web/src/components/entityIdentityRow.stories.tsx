import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { EntityIdentityRow } from "./entityIdentityRow.stylex";
import { EntityPicker, type EntityPickerOption } from "./entityPicker.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import {
  EntityCatalogList,
  type EntityCatalogItem,
} from "./pages/entityCatalog.stylex";
import { SearchResults } from "./searchResults.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const entries: EntityCatalogItem[] = [
  {
    id: 1129,
    href: "/entities/1129",
    name: "Laphroaig",
    kind: "distillery",
    location: "Islay, Scotland",
    isFollowing: true,
    totalBottles: 207,
    totalTastings: 22,
    createBottleHref: "/bottles/new?distiller=1129",
  },
  {
    id: 493,
    href: "/entities/493",
    name: "Yamazaki",
    kind: "distillery",
    location: "Osaka, Japan",
    isFollowing: false,
    totalBottles: 162,
    totalTastings: 13,
  },
  {
    id: 3,
    href: "/entities/3",
    name: "The Glasgow Distillery Company with a long catalog name",
    kind: "company",
    isFollowing: false,
    totalBottles: 0,
    totalTastings: 0,
  },
];
const meta = {
  title: "Components/Catalog/Brand and Producer Identity Row",
  component: EntityIdentityRow,
  args: {
    name: "Laphroaig",
    kind: "distillery",
    location: "Islay, Scotland",
    href: "/entities/1129",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Use this component for every brand or producer row. Identity contains its name, known kind and location, and following status. Use getEntityIdentityProps for API reads. Keep IDs and descriptions on detail screens; counts and actions belong in end or separate table cells. Standard rows use 18px titles; search and sidebar use 15px titles. Names and metadata wrap. Use layout=cell inside a table or selection control. Row Layouts compares the real catalog, sidebar, search, and picker components.",
      },
    },
  },
} satisfies Meta<typeof EntityIdentityRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <ItemList ariaLabel="Brand and producer identity examples">
      <ItemListItem>
        <EntityIdentityRow {...args} />
      </ItemListItem>
      <ItemListItem>
        <EntityIdentityRow {...args} isFollowing />
      </ItemListItem>
      <ItemListItem>
        <EntityIdentityRow
          name="Producer with no location recorded"
          kind="bottler"
          href="/entities/3"
        />
      </ItemListItem>
      <ItemListItem>
        <EntityIdentityRow
          name="A long brand or producer name that wraps while keeping its full identity available"
          kind="company"
          location="A long region name, Scotland"
          href="/entities/4"
        />
      </ItemListItem>
    </ItemList>
  ),
};
export const RowLayouts: Story = { render: () => <RowLayoutsExample /> };
function RowLayoutsExample() {
  const [items, setItems] = useState(entries);
  const [selection, setSelection] = useState<EntityPickerOption | null>({
    id: String(entries[0].id),
    name: entries[0].name,
    kind: entries[0].kind,
    location: entries[0].location,
  });
  return (
    <StoryStack>
      <SectionHeading>Catalog</SectionHeading>
      <EntityCatalogList
        items={items}
        noun="distiller"
        onSortChange={() => undefined}
        onToggleFollowing={(item) =>
          setItems(
            items.map((entry) =>
              entry.id === item.id
                ? { ...entry, isFollowing: !entry.isFollowing }
                : entry,
            ),
          )
        }
        page={1}
        sort="name"
        sortOptions={[{ label: "Name", value: "name" }]}
        total={items.length}
      />
      <SectionHeading>Sidebar</SectionHeading>
      <div {...stylex.props(styles.sidebar)}>
        <ItemList ariaLabel="Related producers">
          {items.map((item) => (
            <ItemListItem key={item.id}>
              <EntityIdentityRow {...item} variant="sidebar" />
            </ItemListItem>
          ))}
        </ItemList>
      </div>
      <SectionHeading>Search</SectionHeading>
      <SearchResults
        query=""
        groups={[
          {
            id: "distillers",
            label: "Distillers",
            items: items.map((item) => ({
              id: String(item.id),
              href: item.href,
              title: item.name,
              entity: {
                name: item.name,
                kind: item.kind,
                location: item.location,
              },
            })),
          },
        ]}
      />
      <SectionHeading>Selection</SectionHeading>
      <EntityPicker
        options={items.map((item) => ({
          id: String(item.id),
          name: item.name,
          kind: item.kind,
          location: item.location,
        }))}
        value={selection}
        onChange={setSelection}
      />
    </StoryStack>
  );
}

const styles = stylex.create({ sidebar: { maxWidth: "320px" } });
