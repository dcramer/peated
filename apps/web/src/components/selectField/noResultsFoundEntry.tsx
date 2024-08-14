export default function NoResultsFoundEntry({
  message = "We couldn't find what you're looking for.",
}: {
  message?: string;
}) {
  return (
    <div className="min-w-0 flex-auto">
      <div className="mt-1 flex gap-x-1 p-4 text-sm">
        <span>{message}</span>
      </div>
    </div>
  );
}
