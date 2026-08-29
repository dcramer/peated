import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStat,
  AdminStatGrid,
  AdminStatus,
  AdminTextLink,
} from "../../admin/adminContent.stylex";
import { AdminTableContent } from "../../admin/adminTable.stylex";
import { ButtonLink } from "../components";
import {
  AdminWorkspace,
  type AdminNavigationGroup,
} from "./adminWorkspace.stylex";

const groups = [
  {
    label: "Moderation",
    items: [
      { href: "/admin/moderation/inbox", label: "Inbox" },
      { href: "/admin/moderation/history", label: "History" },
      { href: "/admin/moderation/automation", label: "Automation" },
    ],
  },
  {
    label: "Admin tools",
    items: [
      { href: "/admin/badges", label: "Badges" },
      { href: "/admin/locations", label: "Locations" },
      { href: "/admin/users", label: "Users" },
    ],
  },
] satisfies readonly AdminNavigationGroup[];

const records = [
  { id: 41, name: "Default", status: "Ready" },
  { id: 42, name: "Hovered", status: "Blocked" },
  { id: 43, name: "Keyboard focused", status: "Ready" },
  { id: 44, name: "Pressed", status: "Ready" },
];

function WorkspaceContent() {
  return (
    <AdminPage>
      <AdminPageHeader
        actions={<ButtonLink href="#new">Add record</ButtonLink>}
        description="Shared admin content primitives inside the responsive workspace."
        eyebrow="Catalog"
        title="Records"
      />
      <AdminStatGrid>
        <AdminStat label="Open" value="24" />
        <AdminStat label="Blocked" value="3" />
        <AdminStat label="Cleared today" value="18" />
      </AdminStatGrid>
      <AdminSection title="Current records">
        <AdminTableContent
          columns={[
            { name: "name" },
            {
              name: "status",
              value: (record) => (
                <AdminStatus
                  tone={record.status === "Blocked" ? "warning" : "success"}
                >
                  {record.status}
                </AdminStatus>
              ),
            },
            {
              align: "right",
              name: "activity",
              value: (record) => (
                <AdminTextLink href={`#activity-${record.id}`}>
                  View activity
                </AdminTextLink>
              ),
            },
          ]}
          items={records}
          searchParams={new URLSearchParams()}
          url={(record) => `#record-${record.id}`}
          withSearch
        />
      </AdminSection>
    </AdminPage>
  );
}

const meta = {
  title: "Components/Navigation/Admin Workspace",
  component: AdminWorkspace,
  args: {
    currentHref: "/admin/moderation/inbox",
    groups,
    children: <WorkspaceContent />,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AdminWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Workspace: Story = {};

export const TableInteractionStates: Story = {
  parameters: {
    pseudo: {
      active: ['tr[data-record-key="44"]'],
      focusWithin: ['tr[data-record-key="43"]'],
      hover: ['tr[data-record-key="42"]'],
    },
  },
};
