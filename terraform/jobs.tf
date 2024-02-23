resource "google_cloud_run_v2_job" "cli" {
  name     = "cli"
  location = var.region

  template {
    template {
      timeout     = "300s"
      max_retries = 1

      volumes {
        name = "cloudsql"

        cloud_sql_instance {
          instances = [module.db-main.connection_name]
        }
      }

      containers {
        # image   = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/cli"
        # placeholder as we dont know the actual image
        image   = "busybox"
        command = ["npm", "run"]

        env {
          name  = "INSTANCE_UNIX_SOCKET"
          value = "/cloudsql/${module.db-main.connection_name}"
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
          name  = "FAKTORY_URL"
          value = "tcp://:${data.google_secret_manager_secret_version.faktory_password.secret_data}@${module.faktory.hostname}:7419"
        }

        env {
          name  = "API_SERVER"
          value = "https://api.peated.com"
        }

        env {
          name  = "URL_PREFIX"
          value = "https://peated.com"
        }

        env {
          name  = "SENTRY_DSN"
          value = var.sentry_dsn
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
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
      client,
      client_version,
      template[0].template[0].containers[0].image
    ]
  }

  depends_on = [module.db-main]
}
