resource "google_cloud_run_v2_service" "scraper" {
  name     = "scraper"
  location = var.region

  template {
    scaling {
      max_instance_count = 1
    }

    containers {
      image = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/scraper"

      env {
        name  = "GOOGLE_CLIENT_ID"
        value = "721909483682-uk3befic1j1krv3drig2puu30v1i4v48.apps.googleusercontent.com"
      }
    }
  }

  timeouts {}

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }
}


