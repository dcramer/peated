import SimpleHeader from "@peated/web/components/simpleHeader";
import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { type ReactNode } from "react";
import BottleFullHeader from "../bottleFullHeader";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const params = await props.params;

  const { bottleId } = params;

  const bottle = await getBottlePage(Number(bottleId));

  return {
    title: `Other Names for ${getBottlePlainTextIdentity(bottle)}`,
  };
}

export default async function Layout(props: {
  params: Promise<{ bottleId: string }>;
  children: ReactNode;
}) {
  const params = await props.params;
  const { children } = props;

  const bottle = await getBottlePage(Number(params.bottleId));

  return (
    <>
      <BottleFullHeader bottle={bottle} />
      <SimpleHeader as="h2">Aliases</SimpleHeader>
      {children}
    </>
  );
}
