# https://gist.github.com/palewire/12c4b2b974ef735d22da7493cf7f4d37
resource "google_artifact_registry_repository" "peated" {
  location      = var.region
  repository_id = "peated"
  description   = ""
  format        = "DOCKER"

  docker_config {
    immutable_tags = true
  }
}
