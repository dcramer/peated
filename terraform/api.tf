module "peated-api-service" {
  source = "./modules/service"
  name   = "peated-api"
  image  = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/api"

  domains = ["api.peated.com", "api.staging.peated.com", "api.peated.app", "api.staging.peated.app"]
  port    = 4000

  cpu    = "500m"
  memory = "2Gi"

  healthcheck = {
    path = "/_health"
  }

  k8s_service_account = module.gke_workload_identity.k8s_service_account_name

  env = {
    DATABASE_URL         = "postgresql://peated:peated@${module.db-main.hostname}/peated"
    GOOGLE_CLIENT_ID     = var.google_client_id
    SENTRY_DSN           = var.sentry_dsn
    SENTRY_SERVICE       = "@peated/api"
    GOOGLE_CLIENT_SECRET = data.google_secret_manager_secret_version.google_client_secret.secret_data
    CORS_HOST            = "https://peated.com"
    API_SERVER           = "https://api.peated.com"
    URL_PREFIX           = "https://peated.com"
    USE_GCS_STORAGE      = "1"
    GCS_BUCKET_NAME      = google_storage_bucket.peated.name
    GCS_BUCKET_PATH      = "uploads"
    NODE_NO_WARNINGS     = "1"
    JWT_SECRET           = data.google_secret_manager_secret_version.jwt_secret.secret_data
    FAKTORY_URL          = "tcp://:${data.google_secret_manager_secret_version.faktory_password.secret_data}@${module.faktory.hostname}:7419"
    DISCORD_WEBHOOK      = data.google_secret_manager_secret_version.discord_webhook.secret_data
    # this is prob a bad idea
    OPENAI_API_KEY = data.google_secret_manager_secret_version.openai_api_key.secret_data
    # OPENAI_HOST     = "https://api.openai.com/v1"
    # OPENAI_MODEL    = "gpt-3.5-turbo"
    ACCESS_TOKEN = data.google_secret_manager_secret_version.api_access_token.secret_data
  }

  depends_on = [module.db-main, module.faktory]
}
