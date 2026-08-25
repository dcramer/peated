import Button from "./button";

export default function CatalogPageHeader({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-x-4 px-3 pb-4 pt-2">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <Button href={actionHref} color="primary" size="small">
        {actionLabel}
      </Button>
    </div>
  );
}
