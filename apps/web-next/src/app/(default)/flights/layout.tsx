import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import { type ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="Flights"
        metadata={
          <Button color="primary" href="/addFlight">
            Add Flight
          </Button>
        }
      />
      {children}
    </>
  );
}
