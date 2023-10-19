module "peated-web-service" {
  source = "./modules/service"
  name   = "peated-web"
  image  = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/web"

  domains = ["peated.com", "staging.peated.com", "www.peated.com", "peated.app", "staging.peated.app"]
  port    = 3000

  healthcheck = {
    path = "/_health"
  }

  k8s_service_account = module.gke_workload_identity.k8s_service_account_name

  env = {
    GOOGLE_CLIENT_ID = var.google_client_id
    SENTRY_DSN       = var.sentry_dsn
    SESSION_SECRET   = data.google_secret_manager_secret_version.session_secret.secret_data
  }

  depends_on = [module.db-main]
}
