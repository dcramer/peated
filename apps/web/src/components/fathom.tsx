"use client";

import { load, trackPageview } from "fathom-client";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

export type Props = {
  siteId: string;
  includedDomains: string[];
};

function TrackPageView({ siteId, includedDomains }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    load(siteId, {
      includedDomains,
    });
  }, [siteId, includedDomains]);

  useEffect(() => {
    trackPageview();

    // Record a pageview when route changes
  }, [pathname, searchParams]);

  return null;
}

/* oxlint-disable anti-slop/require-suspense-loading -- Page tracking renders nothing. */
export default function Fathom(props: Props) {
  return (
    <Suspense fallback={null}>
      <TrackPageView {...props} />
    </Suspense>
  );
}
/* oxlint-enable anti-slop/require-suspense-loading */
