module "api-service" {
  source = "./modules/service"
  name   = "api"
  image  = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/api"

  domains = ["api.peated.app", "api.staging.peated.app"]
  port    = 4000

  healthcheck = {
    path = "/health"
  }

  k8s_service_account = module.gke_workload_identity.k8s_service_account_name

  cloud_sql_instance = module.db-main.connection_name

  env = {
    DATABASE_URL     = "postgresql://peated:peated@127.0.0.1/peated"
    GOOGLE_CLIENT_ID = "721909483682-uk3befic1j1krv3drig2puu30v1i4v48.apps.googleusercontent.com"
    CORS_HOST        = "https://peated.app"
    URL_PREFIX       = "https://api.peated.app"
    USE_GCS_STORAGE  = "1"
    GCS_BUCKET_NAME  = google_storage_bucket.peated.name
    GCS_BUCKET_PATH  = "uploads"
    NODE_NO_WARNINGS = "1"
  }

  depends_on = [module.db-main]
}
