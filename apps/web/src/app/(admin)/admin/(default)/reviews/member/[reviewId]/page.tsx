"use client";

import { use } from "react";

import { AdminContentDetail } from "@peated/web/components/admin/adminContentDetail";

export default function MemberReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = use(params);
  return <AdminContentDetail id={Number(reviewId)} kind="member_review" />;
}
