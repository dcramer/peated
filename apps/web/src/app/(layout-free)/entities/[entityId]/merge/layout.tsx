import DefaultLayout from "@peated/web/components/defaultLayout";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { type Metadata } from "next";
import { type ReactNode } from "react";

export default async function Layout(props: {
  params: Promise<{ entityId: string }>;
  children: ReactNode;
}) {
  const { entityId } = await props.params;
  await getEntityPage(Number(entityId));
  return <DefaultLayout>{props.children}</DefaultLayout>;
}

export const metadata: Metadata = {
  title: "Merge Entity",
};
