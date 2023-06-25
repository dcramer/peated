import { Link } from "@remix-run/react";
import { Breadcrumbs } from "~/components/breadcrumbs";

export default function Admin() {
  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
        ]}
      />
      <div className="prose">
        <ul>
          <li>
            <Link to="/admin/stores">Manage Stores & Pricing Aggregators</Link>
          </li>
        </ul>
      </div>
    </>
  );
}
