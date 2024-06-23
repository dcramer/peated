import { type ReactNode } from "react";
import { getEntity } from "../../../utils.server";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const entity = await getEntity(Number(entityId));

  return [
    {
      title: `Whiskies by ${entity.name}`,
    },
  ];
}

export default function DefaultLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
