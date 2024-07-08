import { PlusIcon } from "@heroicons/react/20/solid";
import Link from "@peated/web/components/link";

export default function FloatingButton({ href }: { href: string }) {
  return (
    <div className="absolute right-24 sm:right-16">
      <Link
        type="button"
        className="bg-highlight fixed bottom-24 z-40 rounded-full p-2 text-black shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:bottom-8"
        href={href}
      >
        <PlusIcon className="h-12 w-12 sm:h-8 sm:w-8" aria-hidden="true" />
      </Link>
    </div>
  );
}
