resource "google_cloud_run_v2_service" "api" {
  name     = "api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 1
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
        name  = "INSTANCE_UNIX_SOCKET"
        value = "/cloudsql/${google_sql_database_instance.main.connection_name}"
      }

      env {
        name  = "DATABASE_USER"
        value = "peated"
      }

      env {
        name  = "DATABASE_PASSWORD"
        value = "peated"
      }

      env {
        name  = "DATABASE_NAME"
        value = "peated"
      }

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

  timeouts {}

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [google_sql_database_instance.main]
}


resource "google_cloud_run_service_iam_binding" "api" {
  location = google_cloud_run_v2_service.api.location
  service  = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  members = [
    "allUsers"
  ]
}

module "api-lb" {
  source            = "./modules/load-balancer"
  name              = "api"
  region            = var.region
  cloud_run_service = google_cloud_run_v2_service.api.name
  domain            = "api.peated.app"
}
