import Button from "./button";

export default function SkeletonButton({ ...props }: { className?: string }) {
  return (
    <span className="w-32" {...props}>
      <Button fullWidth loading>
        &nbsp;
      </Button>
    </span>
  );
}
