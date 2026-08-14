import HistoryPage from "@peated/web/components/admin/moderation/historyPage";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; eventId: string }>;
}) {
  const { kind, eventId } = await params;
  if (
    !["incoming", "operation", "closure"].includes(kind) ||
    !/^\d+$/.test(eventId)
  )
    notFound();
  return <HistoryPage selectedKey={`${kind}:${eventId}`} />;
}
