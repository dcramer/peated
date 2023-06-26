import { Link } from "@remix-run/react";
import Separated from "./separated";
import Tooltip from "./tooltip";

export default function Tags({ tags }: { tags: string[] }) {
  if (!tags || !tags.length) return null;
  return (
    <div className="text-sm">
      <div className="hidden lg:block">
        <Separated separator=", ">
          {tags.slice(0, 3).map((item) => (
            <Link
              key={item}
              className="hover:underline"
              to={`/bottles?tag=${encodeURIComponent(item)}`}
            >
              {item}
            </Link>
          ))}
        </Separated>
        {tags.length > 3 && (
          <span>
            , and{" "}
            <Tooltip title={tags.join(", ")}>
              <span className="underline decoration-dotted">
                {tags.length - 3} more
              </span>
            </Tooltip>
          </span>
        )}
      </div>
      <div className="lg:hidden">
        <Tooltip title={tags.join(", ")}>
          <span className="underline decoration-dotted">
            {tags.length} flavor note{tags.length !== 1 ? "s" : ""}
          </span>
        </Tooltip>
      </div>
    </div>
  );
}
