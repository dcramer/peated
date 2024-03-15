import { BugAntIcon } from "@heroicons/react/24/outline";
import SidebarLink from "../sidebarLink";

export default function FeedbackSidebarLinkServer() {
  return (
    <SidebarLink
      as="a"
      icon={BugAntIcon}
      href="https://github.com/dcramer/peated/issues"
    >
      Report Issue
    </SidebarLink>
  );
}
