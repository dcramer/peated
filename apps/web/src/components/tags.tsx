import Tooltip from "./tooltip";

export default ({ tags }: { tags: string[] }) => {
  if (!tags || !tags.length) return null;
  return (
    <div className="text-sm">
      <div className="hidden sm:block">
        <span>{tags.slice(0, 3).join(", ")}</span>
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
      <div className="sm:hidden">
        <Tooltip title={tags.join(", ")}>
          <span className="underline decoration-dotted">
            {tags.length} flavor note{tags.length !== 1 ? "s" : ""}
          </span>
        </Tooltip>
      </div>
    </div>
  );
};
