import { ClientOnly } from "../clientOnly";
import FeedbackSidebarLinkServer from "./component";
import FeedbackSidebarLinkClient from "./component.client";

export default function FeedbackSidebarLink() {
  return (
    <ClientOnly fallback={<FeedbackSidebarLinkServer />}>
      {() => <FeedbackSidebarLinkClient />}
    </ClientOnly>
  );
}
