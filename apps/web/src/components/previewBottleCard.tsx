import BottleExactMetadata, {
  type BottleExactMetadataSource,
} from "./bottleExactMetadata";
import { getBottleMetadataExclusions } from "./bottleIdentity";
import type { Option } from "./selectField";

type EntityOption = Option & {
  shortName?: string | null;
};

type BottleFormData = {
  name: string;
  brand?: EntityOption | null | undefined;
  series?: Option | null | undefined;
  distillers?: EntityOption[] | null | undefined;
  edition?: string | null | undefined;
} & Partial<BottleExactMetadataSource>;

export const PreviewBottleCard = ({
  data,
}: {
  data: Partial<BottleFormData>;
}) => {
  const { brand, series } = data;
  const exactBottle = {
    category: null,
    edition: data.edition ?? null,
    statedAge: data.statedAge ?? null,
    abv: data.abv ?? null,
    vintageYear: data.vintageYear ?? null,
    bottlingYear: data.bottlingYear ?? null,
    releaseYear: data.releaseYear ?? null,
    singleCask: data.singleCask ?? null,
    caskStrength: data.caskStrength ?? null,
    caskFill: data.caskFill ?? null,
    caskType: data.caskType ?? null,
    caskSize: data.caskSize ?? null,
  };
  const metadataExclude = getBottleMetadataExclusions(
    exactBottle,
    data.name ?? "",
  );
  const showSeries = Boolean(
    series &&
    data.name &&
    !data.name.toLocaleLowerCase().includes(series.name.toLocaleLowerCase()),
  );

  return (
    <section
      aria-label="Bottle preview"
      className="bg-highlight min-w-0 p-4 text-black sm:rounded lg:p-5"
    >
      {brand && (
        <div className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium uppercase tracking-wide text-black/60">
          <span className="truncate">{brand.shortName || brand.name}</span>
          {showSeries ? (
            <>
              <span aria-hidden="true">&middot;</span>
              <span className="truncate">{series!.name}</span>
            </>
          ) : null}
        </div>
      )}
      {data.name && (
        <div className="break-words font-semibold">{data.name}</div>
      )}
      <BottleExactMetadata
        className="!text-black/70"
        bottle={exactBottle}
        exclude={[...metadataExclude]}
      />
    </section>
  );
};
