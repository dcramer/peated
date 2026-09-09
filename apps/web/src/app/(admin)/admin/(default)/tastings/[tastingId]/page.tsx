"use client";

import { use } from "react";

import { AdminContentDetail } from "@peated/web/components/admin/adminContentDetail";

export default function TastingPage({
  params,
}: {
  params: Promise<{ tastingId: string }>;
}) {
  const { tastingId } = use(params);
  return <AdminContentDetail id={Number(tastingId)} kind="tasting" />;
}
