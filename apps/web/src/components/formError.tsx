import type { ReactNode } from "react";
import Alert from "./alert";

export default function FormError({ values }: { values: ReactNode[] }) {
  return (
    <Alert>
      <h3 className="text-sm font-semibold text-white">
        There was an error with your submission
      </h3>
      <div className="mt-2 text-sm font-medium text-white">
        <ul role="list" className="list-disc space-y-1 pl-5">
          {values.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </div>
    </Alert>
  );
}
