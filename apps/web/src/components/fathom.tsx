"use client";

import { useLocation } from "@tanstack/react-router";
import { load, trackPageview } from "fathom-client";
import { Suspense, useEffect } from "react";

export type Props = {
  siteId: string;
  includedDomains: string[];
};

function TrackPageView({ siteId, includedDomains }: Props) {
  const location = useLocation();
  const pathname = location.pathname;
  const searchParams = new URLSearchParams(location.search);

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

export default function Fathom(props: Props) {
  return (
    <Suspense fallback={null}>
      <TrackPageView {...props} />
    </Suspense>
  );
}
