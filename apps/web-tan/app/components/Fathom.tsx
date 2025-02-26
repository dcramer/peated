import { useRouter } from "@tanstack/react-router";
import { load, trackPageview } from "fathom-client";
import { useEffect } from "react";

interface FathomProps {
  siteId: string;
  includedDomains: string[];
}

/**
 * Fathom analytics component for TanStack Router
 * Tracks page views when routes change
 */
export default function Fathom({ siteId, includedDomains }: FathomProps) {
  const router = useRouter();

  useEffect(() => {
    // Initialize Fathom with site ID and domains
    load(siteId, {
      includedDomains,
    });
  }, [siteId, includedDomains]);

  useEffect(() => {
    // Track page views when the route changes
    const unsubscribe = router.history.subscribe(() => {
      trackPageview();
    });

    // Clean up subscription when component unmounts
    return () => {
      unsubscribe();
    };
  }, [router]);

  return null;
}
