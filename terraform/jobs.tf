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
          instances = [module.db-main.connection_name]
        }
      }

      containers {
        image   = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/api:latest"
        command = ["npm", "run", "db:migrate"]

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

  depends_on = [module.db-main]
}

# TODO: this is really complicated on CloudRun so lets just move this to Faktory ASAP
# resource "google_cloud_run_v2_job" "scraper" {
#   name     = "scraper"
#   location = var.region

#   template {
#     parallelism = 1

#     template {
#       # max_retries = 1
#       timeout = 3600 # basically just reboot the process every hour

#       containers {
#         image = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/scraper:latest"

#         env {
#           name  = "GOOGLE_CLIENT_ID"
#           value = "721909483682-uk3befic1j1krv3drig2puu30v1i4v48.apps.googleusercontent.com"
#         }

#         resources {
#           limits = {
#             cpu    = "1000m"
#             memory = "1Gi"
#           }
#         }
#       }
#     }
#   }

#   timeouts {}

#   lifecycle {
#     ignore_changes = [
#       launch_stage,
#     ]
#   }

#   depends_on = [google_cloud_run_v2_service.api]

# }
