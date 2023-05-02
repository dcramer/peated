import { PlusIcon } from "@heroicons/react/20/solid";
import { Link } from "react-router-dom";

export default ({ to }: { to: string }) => {
  return (
    <Link
      type="button"
      className="rounded-full bg-peated p-2 text-white shadow-sm hover:bg-peated-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated fixed bottom-8 right-8"
      to={to}
    >
      <PlusIcon className="h-8 w-8" aria-hidden="true" />
    </Link>
  );
};
