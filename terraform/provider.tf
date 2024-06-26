terraform {
  required_version = ">=1.6.6"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.33.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.33.0"
    }
  }
}

data "google_project" "project" {}

# data "google_container_cluster" (var.cluster_name) {
#   name     = var.cluster_name
#   location = var.region
# }

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
