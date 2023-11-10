import { ShareIcon } from "@heroicons/react/24/outline";
import Button from "./button";
import { ClientOnly } from "./clientOnly";

export default function ShareButton({
  title,
  url,
  ...props
}: {
  title?: string;
  url?: string;
}) {
  return (
    <ClientOnly>
      {() => {
        if (!navigator.share) return null;
        return (
          <Button
            icon={<ShareIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />}
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: title ?? document.title,
                    url: url ?? document.location.href,
                  })
                  .catch((error) => console.error("Error sharing", error));
              }
            }}
            {...props}
          />
        );
      }}
    </ClientOnly>
  );
}
