import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, RowMenu } from "..";
import { EntityPageHeader } from "./entityPageHeader.stylex";

const meta = {
  title: "Components/Brands & Producers/Brand and Producer Header",
  component: EntityPageHeader,
  decorators: [
    (Story) => (
      <main>
        <Story />
      </main>
    ),
  ],
  args: {
    actions: (
      <Button size="lg" variant="accent">
        Add a bottle
      </Button>
    ),
    description:
      "An Islay distillery known for heavily peated single malt whisky.",
    detail: "Distillery",
    metadata: "Islay · Scotland",
    id: "E9201",
    menu: (
      <RowMenu
        groups={[
          [{ label: "Share", onSelect: () => undefined }],
          [
            { href: "#aliases", label: "View aliases" },
            { href: "#edit", label: "Edit distillery" },
          ],
        ]}
        label="Lagavulin"
        variant="page"
      />
    ),
    parent: "Part of Diageo",
    specs: [
      { label: "Founded", value: 1816 },
      { label: "Country", value: "Scotland" },
      { label: "Bottles", value: 84 },
      { label: "Tastings", value: "1,200" },
    ],
    title: "Lagavulin",
  },
} satisfies Meta<typeof EntityPageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ThinData: Story = {
  args: {
    actions: undefined,
    description: undefined,
    detail: "Distillery",
    metadata: "Scotland",
    menu: undefined,
    parent: undefined,
    specs: [
      { label: "Founded", value: null },
      { label: "Country", value: "Scotland" },
      { label: "Bottles", value: 0 },
      { label: "Tastings", value: 0 },
    ],
    title: "A deliberately long unnamed distillery name",
  },
};
