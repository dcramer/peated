module "worker-service" {
  source = "./modules/service"
  name   = "worker"
  image  = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/worker"

  healthcheck = {
    path = "/health"
  }

  k8s_service_account = module.gke_workload_identity.k8s_service_account_name

  env = {
    GOOGLE_CLIENT_ID = "721909483682-uk3befic1j1krv3drig2puu30v1i4v48.apps.googleusercontent.com"
    CORS_HOST        = "https://peated.app"
    URL_PREFIX       = "https://api.peated.app"
    NODE_NO_WARNINGS = "1"
    # this is prob a bad idea
    OPENAI_API_KEY = data.google_secret_manager_secret_version.openai_api_key.secret_data
  }
}
