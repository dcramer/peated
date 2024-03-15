import { BugAntIcon } from "@heroicons/react/24/outline";
import { Feedback } from "@sentry-internal/feedback";
import * as Sentry from "@sentry/remix";
import { useCallback, useState } from "react";
import SidebarLink from "../sidebarLink";

export default function FeedbackSidebarLinkClient() {
  const [loaded, setLoaded] = useState(false);
  const feedback = Sentry.getCurrentHub().getIntegration(Feedback);

  const linkRef = useCallback(
    (node: HTMLAnchorElement) => {
      if (!feedback || loaded) return;
      feedback.attachTo(node, {});
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
