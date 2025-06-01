import { Link } from "@tanstack/react-router";
import Separated from "./separated";
import Tooltip from "./tooltip";

export default function Tags({ tags }: { tags: string[] }) {
  if (!tags || !tags.length) return null;
  return (
    <div className="text-sm">
      <Separated separator=", ">
        {tags.slice(0, 3).map((item) => (
          <Link
            key={item}
            className="hover:underline"
            to="/bottles"
            search={{ tag: item }}
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
  );
}
