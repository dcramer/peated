
module "db-main" {
  source    = "./modules/cloud-sql"
  name      = "peated-main"
  project_id = var.project_id
  region    = var.region
  databases = ["peated"]
  users     = [{ name = "peated", password = "peated" }]
  k8s_service_account = module.gke_workload_identity.k8s_service_account_name
}
