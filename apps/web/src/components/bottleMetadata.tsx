import { ComponentPropsWithoutRef } from "react";
import { Link } from "react-router-dom";
import Tooltip from "./tooltip";

type Props = {
  data: {
    brand?:
      | {
          id?: string | number | undefined | null;
          name: string;
        }
      | undefined
      | null;
    distillers?:
      | {
          id?: string | number | undefined | null;
          name: string;
        }[]
      | undefined
      | null;
  };
  showBrand?: boolean;
} & ComponentPropsWithoutRef<"p">;

export default ({ data, showBrand = false, ...props }: Props) => {
  return (
    <div {...props}>
      <div className="inline-flex space-x-1">
        <Brand data={data} />
        {!!data.distillers?.length && (
          <span className="hidden sm:inline-block">&middot;</span>
        )}
        <Distillers data={data} />
      </div>
    </div>
  );
};

const Brand = ({ data: { brand } }: Props) => {
  const brandName = brand?.name || "Unknown";

  return (
    <div className="hidden space-x-1 sm:inline-block">
      <span className="hidden sm:inline-block">Produced by</span>
      {brand?.id ? (
        <Tooltip title={brandName} origin="left">
          <Link
            to={`/entities/${brand.id}`}
            title={brandName}
            className="inline-block max-w-[150px] truncate align-bottom hover:underline"
          >
            {brandName}
          </Link>
        </Tooltip>
      ) : (
        <span>{brandName}</span>
      )}
    </div>
  );
};

const Distillers = ({ data: { distillers } }: Props) => {
  if (!distillers?.length) return null;

  if (distillers.length > 1) {
    return (
      <Tooltip title={distillers.map((d) => d.name).join(", ")}>
        <span className="underline decoration-dotted">
          {distillers.length} distillers
        </span>
      </Tooltip>
    );
  }

  const d = distillers[0];
  return (
    <>
      <span className="hidden sm:inline-block">Distilled at</span>
      {d.id ? (
        <Tooltip
          origin="center"
          title={distillers.map((d) => d.name).join(", ")}
        >
          <Link
            key={d.id}
            to={`/entities/${d.id}`}
            title={d.name}
            className="inline-block max-w-[150px] truncate align-bottom hover:underline"
          >
            {d.name}
          </Link>
        </Tooltip>
      ) : (
        d.name
      )}
    </>
  );
};
