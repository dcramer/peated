import { Button, IconButton } from "@peated/web/components/button.stylex";
import {
  LoadingList,
  LoadingPlaceholder,
} from "@peated/web/components/feedback.stylex";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";

export default function Loading() {
  return (
    <>
      <PageHeader
        actions={
          <Button disabled size="md" variant="tonal">
            Open tasting view
          </Button>
        }
        description={<LoadingPlaceholder preset="text" />}
        metadata={<LoadingPlaceholder preset="pageMetadata" />}
        menu={
          <IconButton
            aria-hidden="true"
            disabled
            icon={<span aria-hidden="true">⋮</span>}
            label=""
            size="lg"
            variant="tonal"
          />
        }
        title={<LoadingPlaceholder preset="pageTitle" />}
      />
      <PageSection heading="Bottles">
        <LoadingList
          label="Loading flight bottles"
          rows={4}
          variant="bottleAction"
        />
      </PageSection>
    </>
  );
}
