import { CardGrid, LocationCardLoading } from "@peated/web/components";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading locations" role="status">
      <CardGrid>
        {([0, 1, 2, 3] as const).map((delay) => (
          <LocationCardLoading delay={delay} key={delay} />
        ))}
      </CardGrid>
    </div>
  );
}
