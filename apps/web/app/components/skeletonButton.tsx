import Button from "./button";

export default function SkeletonButton() {
  return (
    <span className="w-32">
      <Button fullWidth loading>
        &nbsp;
      </Button>
    </span>
  );
}
