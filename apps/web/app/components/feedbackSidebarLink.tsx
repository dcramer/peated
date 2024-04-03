import { BugAntIcon } from "@heroicons/react/24/outline";
import type { feedbackIntegration } from "@sentry/remix";
import { getClient } from "@sentry/remix";
import { useCallback, useState } from "react";
import SidebarLink from "./sidebarLink";

export default function FeedbackSidebarLink() {
  const [loaded, setLoaded] = useState(false);

  // TODO: we need some kind of callback as there is a race condition where this isnt
  // always returned even though it gets loaded in `entry.client` before hydration

  const feedback =
    getClient()?.getIntegrationByName?.<ReturnType<typeof feedbackIntegration>>(
      "Feedback",
    ) ?? null;

  const linkRef = useCallback(
    (node: HTMLAnchorElement) => {
      if (!feedback || loaded || !node) return;
      // TODO: Type this better, and remove the type cast...
      console.log("setting loaded", node);
      (feedback as any).attachTo(node, {});
      setLoaded(true);
    },
    [feedback, loaded],
  );

  return (
    <SidebarLink
      as="a"
      ref={linkRef}
      href={loaded ? undefined : "https://github.com/dcramer/peated/issues"}
      icon={BugAntIcon}
    >
      Report Issue
    </SidebarLink>
  );
}
