import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { UpdateListLoading } from "./updateList.stylex";

export default function UpdatesLoading() {
  return (
    <div>
      <PageHeader title="Updates" />
      <PageSection heading="Recent changes">
        <UpdateListLoading />
      </PageSection>
    </div>
  );
}
