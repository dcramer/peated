import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BottleList, DistributionList, FactList } from "..";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  PageColumns,
  PageHeader,
  PageSection,
  TabbedPage,
} from "./pageLayout.stylex";

const meta = {
  title: "Components/Layout/Catalog Detail Page",
  parameters: {
    docs: {
      description: {
        component:
          "Use these components to build catalog detail pages. Use PageSection for section headings in both columns. Keep data loading, sign-in state, navigation, and updates in the page route.",
      },
    },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="page">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const tabs = [
  { href: "/catalog/scotland", label: "Overview" },
  { href: "/catalog/scotland/bottles", label: "Bottles", count: 1284 },
  { href: "/catalog/scotland/distillers", label: "Distillers", count: 148 },
] as const;

export const Overview: Story = {
  render: () => (
    <TabbedPage
      currentHref="/catalog/scotland"
      header={
        <PageHeader
          description="A short description can sit here."
          title="Scotland"
        />
      }
      tabs={tabs}
      tabsLabel="Scotland catalog sections"
    >
      <PageColumns
        rail={
          <div>
            <PageSection heading="Bottles">
              <BottleList
                ariaLabel="Bottles"
                items={mockBottles
                  .slice(0, 2)
                  .map((bottle) => toBottleListItem(bottle))}
              />
            </PageSection>
            <PageSection heading="Production rules">
              Show established production facts when the page includes them.
            </PageSection>
          </div>
        }
        railBehavior="stack"
      >
        <FactList
          facts={[
            { label: "Bottles", value: "1,284" },
            { label: "Distilleries", value: 148 },
          ]}
          layout="grid"
        />
        <PageSection heading="Bottles by category">
          <DistributionList
            items={[
              { count: 842, label: "Single malt" },
              { count: 311, label: "Blend" },
              { count: 126, label: "Single grain" },
            ]}
          />
        </PageSection>
      </PageColumns>
    </TabbedPage>
  ),
};

export const Minimal: Story = {
  render: () => (
    <TabbedPage
      currentHref="/catalog/new-region"
      header={<PageHeader title="New region" />}
      tabs={[{ href: "/catalog/new-region", label: "Overview" }]}
      tabsLabel="New region catalog sections"
    >
      <PageColumns>
        <FactList
          facts={[
            { label: "Bottles", value: 0 },
            { label: "Distilleries", value: 0 },
          ]}
          layout="grid"
        />
      </PageColumns>
    </TabbedPage>
  ),
};
