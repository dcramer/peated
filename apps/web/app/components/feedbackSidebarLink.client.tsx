import { BugAntIcon } from "@heroicons/react/24/outline";
import { Feedback } from "@sentry-internal/feedback";
import * as Sentry from "@sentry/remix";
import { useEffect, useRef } from "react";
import SidebarLink from "./sidebarLink";

export function FeedbackSidebarLink() {
  const feedback = Sentry.getCurrentHub().getIntegration(Feedback);

  const ref = useRef<"button">();

  useEffect(() => {
    if (!ref.current) return;
    if (feedback) feedback.attachTo(ref.current, {});
  }, [ref]);

  if (!feedback) return null;

  return (
    <SidebarLink as="button" ref={ref} icon={BugAntIcon}>
      Report Issue
    </SidebarLink>
  );
}
