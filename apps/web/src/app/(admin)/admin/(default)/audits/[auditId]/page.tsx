"use client";

import { useParams } from "next/navigation";
import AuditReview from "../_components/auditReview";

export default function Page() {
  const { auditId } = useParams<{ auditId: string }>();
  return <AuditReview auditId={Number(auditId)} />;
}
