import { CatalogPageLoading } from "@peated/web/components/pages/catalogPage.stylex";

export default function FollowingLoading() {
  return (
    <CatalogPageLoading
      action={false}
      navigation
      title="Following"
      variant="entity"
    />
  );
}
