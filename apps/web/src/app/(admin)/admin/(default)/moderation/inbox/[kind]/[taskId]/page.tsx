import InboxPage from "@peated/web/components/admin/moderation/inboxPage";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; taskId: string }>;
}) {
  const { kind, taskId } = await params;
  if (
    !["listing", "operation", "finding"].includes(kind) ||
    !/^\d+$/.test(taskId)
  ) {
    notFound();
  }
  return (
    <InboxPage
      selected={{
        kind: kind as "listing" | "operation" | "finding",
        id: Number(taskId),
      }}
    />
  );
}
