import { AdminSection, AdminStatus } from "./adminContent.stylex";

export default function ScraperAdapterStatus() {
  // TODO(scraper-source-migration): This branch also covers ordinary HTML
  // adapters. Remove that compatibility after each site has an active
  // database-managed revision; keep it for custom sources such as SMWS.
  return (
    <AdminSection
      title="Scraper"
      description="This scraper is managed in code, so its rules cannot be edited here."
      action={<AdminStatus tone="neutral">Managed in code</AdminStatus>}
    >
      You can still change its schedule, run it, and view its history here.
    </AdminSection>
  );
}
