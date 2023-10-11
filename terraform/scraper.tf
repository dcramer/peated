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

      env {
        name  = "CORS_HOST"
        value = "https://peated.app"
      }

      env {
        name  = "URL_PREFIX"
        value = "https://api.peated.app"
      }

      env {
        name  = "USE_GCS_STORAGE"
        value = "1"
      }

      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.peated.name
      }

      env {
        name  = "GCS_BUCKET_PATH"
        value = "uploads"
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


