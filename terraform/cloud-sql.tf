
module "db-main" {
  source    = "./modules/cloud-sql"
  name      = "peated-main"
  region    = var.region
  databases = ["peated"]
  users     = [{ name = "peated", password = "peated" }]

  # network_id = module.gke.
}
