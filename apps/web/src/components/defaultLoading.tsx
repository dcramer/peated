import Spinner from "@peated/web/components/spinner";

export default function DefaultLoading() {
  return (
    <div className="flex min-h-96 items-start justify-center pt-16">
      <Spinner className="m-0 text-slate-800" />
    </div>
  );
}
