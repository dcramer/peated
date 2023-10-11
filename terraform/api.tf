resource "google_cloud_run_v2_service" "api" {
  name     = "api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = 2
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/api"

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

      ports {
        container_port = 4000
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "1Gi"
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_sql_database_instance.main
  ]

  timeouts {}

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }
}


