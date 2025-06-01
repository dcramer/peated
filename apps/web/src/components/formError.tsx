import type { ReactNode } from "react";
import Alert from "./alert";

export default function FormError({ values }: { values: ReactNode[] }) {
  return (
    <Alert>
      <h3 className="font-semibold text-sm text-white">
        There was an error with your submission
      </h3>
      <div className="mt-2 font-medium text-sm text-white">
        <ul className="list-disc space-y-1 pl-5">
          {values.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </div>
    </Alert>
  );
}
