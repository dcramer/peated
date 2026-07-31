import BottleExactMetadata, {
  type BottleExactMetadataSource,
} from "./bottleExactMetadata";
import { getBottleMetadataExclusions } from "./bottleIdentity";
import type { Option } from "./selectField";
import SingleCaskChip from "./singleCaskChip";

type EntityOption = Option & {
  shortName?: string;
};

type BottleFormData = {
  name: string;
  brand?: EntityOption | null | undefined;
  distillers?: EntityOption[] | null | undefined;
  edition?: string | null | undefined;
} & Partial<BottleExactMetadataSource>;

export const PreviewBottleCard = ({
  data,
}: {
  data: Partial<BottleFormData>;
}) => {
  const { brand } = data;
  const exactBottle = {
    category: null,
    edition: data.edition ?? null,
    statedAge: data.statedAge ?? null,
    abv: data.abv ?? null,
    vintageYear: data.vintageYear ?? null,
    releaseYear: data.releaseYear ?? null,
    singleCask: data.singleCask ?? null,
    caskStrength: data.caskStrength ?? null,
    caskFill: data.caskFill ?? null,
    caskType: data.caskType ?? null,
    caskSize: data.caskSize ?? null,
  };
  const editionInTitle = Boolean(
    data.edition &&
    data.name?.toLocaleLowerCase().includes(data.edition.toLocaleLowerCase()),
  );
  const leadingEdition = editionInTitle ? undefined : data.edition || undefined;
  const metadataExclude = getBottleMetadataExclusions(
    exactBottle,
    [data.name, leadingEdition].filter(Boolean).join(" "),
  );
  const showSingleCaskChip =
    data.singleCask && !metadataExclude.has("single-cask");

  if (showSingleCaskChip) metadataExclude.add("single-cask");

  return (
    <section
      aria-label="Bottle preview"
      className="bg-highlight min-w-0 p-4 text-black sm:rounded lg:p-5"
    >
      {brand && (
        <div className="truncate text-xs font-medium uppercase tracking-wide text-black/60">
          {brand.shortName || brand.name}
        </div>
      )}
      {data.name && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
          <div className="break-words font-semibold">{data.name}</div>
          {showSingleCaskChip ? (
            <SingleCaskChip className="!border-black/20 !bg-black/10 !text-black hover:!bg-black/10" />
          ) : null}
        </div>
      )}
      <BottleExactMetadata
        className="!text-black/70"
        bottle={exactBottle}
        exclude={[...metadataExclude]}
        leadingContent={leadingEdition}
      />
    </section>
  );
};
