variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_number" {
  description = "GCP Project Number"
  type        = string
}

variable "region" {
  type        = string
  description = "GCP region"
}

variable "zones" {
  type    = list(string)
  default = ["us-central1-a"]
}
