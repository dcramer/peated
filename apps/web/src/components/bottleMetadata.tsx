import { ComponentPropsWithoutRef } from "react";
import { Link } from "react-router-dom";
import Tooltip from "./tooltip";

type Props = {
  data: {
    brand?: {
      id?: string | undefined | null;
      name: string;
    };
    distillers?: {
      id?: string | undefined | null;
      name: string;
    }[];
  };
} & ComponentPropsWithoutRef<"p">;

export default ({ data, ...props }: Props) => {
  const brandName = data.brand?.name || "Unknown";
  return (
    <div {...props}>
      <div className="space-x-1">
        <span className="hidden sm:inline-block">Produced by</span>
        {data.brand?.id ? (
          <Tooltip title={brandName} origin="left">
            <Link
              to={`/entities/${data.brand.id}`}
              title={brandName}
              className="inline-block max-w-[150px] truncate align-bottom hover:underline"
            >
              {brandName}
            </Link>
          </Tooltip>
        ) : (
          brandName
        )}
        <Distillers data={data} />
      </div>
    </div>
  );
};

const Distillers = ({ data: { distillers, brand } }: Props) => {
  if (!distillers || !distillers.length) return null;

  if (distillers.length > 1) {
    return (
      <span>
        {" "}
        &middot;{" "}
        <Tooltip title={distillers.map((d) => d.name).join(", ")}>
          <span className="underline decoration-dotted">
            {distillers.length} distillers
          </span>
        </Tooltip>
      </span>
    );
  }

  if (distillers.length == 1 && brand?.name === distillers[0].name) {
    return null;
  }

  const d = distillers[0];
  return (
    <>
      <span>&middot;</span>
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
