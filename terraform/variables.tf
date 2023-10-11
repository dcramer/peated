
data "google_project" "project" {}

variable "project_id" {
  description = "GCP Project ID"
}

variable "project_number" {
  description = "GCP Project Number"
}

variable "region" {
  type        = string
  description = "GCP region"
}
