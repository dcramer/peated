import InboxPage from "@peated/web/components/admin/moderation/inboxPage";
import { notFound } from "next/navigation";
import { z } from "zod";

const InboxKindSchema = z.enum(["listing", "operation", "finding"]);

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; taskId: string }>;
}) {
  const { kind, taskId } = await params;
  const parsedKind = InboxKindSchema.safeParse(kind);
  if (!parsedKind.success || !/^\d+$/.test(taskId)) {
    notFound();
  }
  return (
    <InboxPage
      selected={{
        kind: parsedKind.data,
        id: Number(taskId),
      }}
    />
  );
}
