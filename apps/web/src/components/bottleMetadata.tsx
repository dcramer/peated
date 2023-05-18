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
      <div className="overflow-hidden text-ellipsis whitespace-nowrap">
        Produced by{" "}
        {data.brand?.id ? (
          <Link to={`/entities/${data.brand.id}`} className="hover:underline">
            {brandName}
          </Link>
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
    <span>
      {" "}
      &middot; Distilled at{" "}
      {d.id ? (
        <Link key={d.id} to={`/entities/${d.id}`} className="hover:underline">
          {d.name}
        </Link>
      ) : (
        d.name
      )}
    </span>
  );
};
