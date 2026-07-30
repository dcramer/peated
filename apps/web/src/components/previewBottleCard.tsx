import BottleExactMetadata, {
  type BottleExactMetadataSource,
} from "./bottleExactMetadata";
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
          {data.singleCask ? (
            <SingleCaskChip className="!border-black/20 !bg-black/10 !text-black hover:!bg-black/10" />
          ) : null}
        </div>
      )}
      <BottleExactMetadata
        className="!text-black/70"
        bottle={{
          category: null,
          statedAge: data.statedAge ?? null,
          abv: data.abv ?? null,
          vintageYear: data.vintageYear ?? null,
          releaseYear: data.releaseYear ?? null,
          singleCask: false,
          caskStrength: data.caskStrength ?? null,
          caskFill: data.caskFill ?? null,
          caskType: data.caskType ?? null,
          caskSize: data.caskSize ?? null,
        }}
        leadingContent={data.edition || undefined}
      />
    </section>
  );
};
