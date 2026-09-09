"use client";

import { use } from "react";

import { AdminContentDetail } from "@peated/web/components/admin/adminContentDetail";

export default function CriticReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = use(params);
  return <AdminContentDetail id={Number(reviewId)} kind="external_review" />;
}
