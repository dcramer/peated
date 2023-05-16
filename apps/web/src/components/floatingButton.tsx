import { PlusIcon } from "@heroicons/react/20/solid";
import { Link } from "react-router-dom";

export default ({ to }: { to: string }) => {
  return (
    <div className="absolute right-8">
      <Link
        type="button"
        className="bg-highlight fixed bottom-8 z-10 rounded-full p-2 text-black shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        to={to}
      >
        <PlusIcon className="h-8 w-8" aria-hidden="true" />
      </Link>
    </div>
  );
};
