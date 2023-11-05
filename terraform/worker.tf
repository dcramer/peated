module "peated-worker-service" {
  source = "./modules/service"
  name   = "peated-worker"
  image  = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/worker"

  memory = "1Gi"

  k8s_service_account = module.gke_workload_identity.k8s_service_account_name

  cloud_sql_instance = module.db-main.connection_name

  env = {
    DATABASE_URL     = "postgresql://peated:peated@127.0.0.1/peated"
    GOOGLE_CLIENT_ID = var.google_client_id
    SENTRY_DSN       = var.sentry_dsn
    API_SERVER       = "https://api.peated.com"
    NODE_NO_WARNINGS = "1"
    # this is prob a bad idea
    OPENAI_API_KEY  = data.google_secret_manager_secret_version.openai_api_key.secret_data
    ACCESS_TOKEN    = data.google_secret_manager_secret_version.api_access_token.secret_data
    FAKTORY_URL     = "tcp://:${data.google_secret_manager_secret_version.faktory_password.secret_data}@${var.faktory_host}:7419"
    DISCORD_WEBHOOK = data.google_secret_manager_secret_version.discord_webhook.secret_data
  }

  depends_on = [module.db-main, module.faktory]
}
