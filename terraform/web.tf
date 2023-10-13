module "web-service" {
  source = "./modules/service"
  name   = "web"
  image  = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/web"

  domains = ["peated.app", "staging.peated.app"]
  port    = 3000

  healthcheck = {
    path = "/healthcheck"
  }

  k8s_service_account = module.gke_workload_identity.k8s_service_account_name

  cloud_sql_instance = module.db-main.connection_name

  env = {
    GOOGLE_CLIENT_ID = "721909483682-uk3befic1j1krv3drig2puu30v1i4v48.apps.googleusercontent.com"
    # this is prob a bad idea
    SESSION_SECRET = data.google_secret_manager_secret_version.session_secret.secret_data
  }

  depends_on = [module.db-main]
}
