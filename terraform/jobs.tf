resource "google_cloud_run_v2_job" "migrate_database" {
  name     = "migrate-database"
  location = var.region

  template {
    template {
      timeout     = "300s"
      max_retries = 1

      volumes {
        name = "cloudsql"

        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }

      containers {
        image   = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/api:latest"
        command = ["npm", "run", "db:migrate"]

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
    ]
  }

  depends_on = [google_sql_database_instance.main]
}
