import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { type ReactNode } from "react";

export const fetchCache = "default-no-store";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

  return [
    {
      title: `Whiskies by ${entity.name}`,
    },
  ];
}

export default function DefaultLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
