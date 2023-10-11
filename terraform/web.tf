resource "google_cloud_run_v2_service" "web" {
  name     = "web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = 2
    }

    containers {
      image = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/web"

      ports {
        container_port = 3000
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
}
