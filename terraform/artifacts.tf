resource "google_artifact_registry_repository" "peated" {
  location      = var.region
  repository_id = "peated"
  description   = ""
  format        = "DOCKER"

  docker_config {
    immutable_tags = true
  }
}
