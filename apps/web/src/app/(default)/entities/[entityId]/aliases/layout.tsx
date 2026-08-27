import SimpleHeader from "@peated/web/components/simpleHeader";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { type ReactNode } from "react";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const params = await props.params;

  const { entityId } = params;

  const entity = await getEntityPage(Number(entityId));

  return {
    title: `Other Names for ${entity.name}`,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SimpleHeader as="h2">Aliases</SimpleHeader>
      {children}
    </>
  );
}
