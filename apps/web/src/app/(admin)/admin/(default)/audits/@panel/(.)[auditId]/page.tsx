"use client";

import SidePanel, { SidePanelHeader } from "@peated/web/components/sidePanel";
import { useParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import AuditReview from "../../_components/auditReview";

function LoadingAuditReview() {
  return (
    <div className="space-y-4 px-3 pb-28 lg:px-0 lg:pb-8" role="status">
      <div className="h-14 animate-pulse rounded-xl bg-slate-800" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-800" />
      <div className="h-48 animate-pulse rounded-xl bg-slate-800" />
      <span className="sr-only">Loading audit review</span>
    </div>
  );
}

export default function Page() {
  const { auditId } = useParams<{ auditId: string }>();
  const router = useRouter();
  const auditNumber = Number(auditId);

  return (
    <SidePanel onClose={() => router.back()} open>
      <SidePanelHeader title={`Audit #${auditNumber}`} />
      <Suspense fallback={<LoadingAuditReview />}>
        <AuditReview auditId={auditNumber} presentation="panel" />
      </Suspense>
    </SidePanel>
  );
}
