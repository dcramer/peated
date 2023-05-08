import { ReactNode, useEffect, useState } from "react";

import FormField from "./formField";
import BarcodeScanner from "./barcodeScanner";
import Button from "./button";
import Alert from "./alert";
import { createPortal } from "react-dom";

type Props = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
};

export default ({ name, helpText, label, required, className }: Props) => {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<(string | null)[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>();

  useEffect(() => {
    // https://github.com/microsoft/TypeScript/issues/33923
    const permissionName = "camera" as PermissionName;
    navigator.permissions
      .query({ name: permissionName })
      .then((r) => setHasPermission(r.state !== "denied"));
  });

  return (
    <FormField
      label={label}
      htmlFor={`f-${name}`}
      required={required}
      helpText={helpText}
      className={className}
    >
      <p>This isn't fully functional, yet.</p>
      <Button onClick={() => setScanning(!scanning)}>
        {hasPermission === false && (
          <Alert>You will need to grant camera permission.</Alert>
        )}
        {scanning ? "Stop Scanning" : "Scan Barcode"}
      </Button>
      <ul className="results">{results.map((result) => result)}</ul>
      <BarcodeScanner
        open={scanning}
        setOpen={setScanning}
        onDetected={(result) => {
          setResults([...results, result]);
        }}
      />
    </FormField>
  );
};
