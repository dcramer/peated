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

variable "cluster_name" {
  type        = string
  description = "The name for the GKE cluster"
}

variable "network" {
  type        = string
  description = "The VPC network created to host the cluster in"
  default     = "gke-network"
}

variable "subnet" {
  type        = string
  description = "The subnetwork created to host the cluster in"
  default     = "gke-subnet"
}

# variable "auth_subnet" {
#   type    = string
#   default = "gke-auth-subnet"
# }

variable "ip_range_pods_name" {
  type        = string
  description = "The secondary ip range to use for pods"
  default     = "ip-range-pods"
}

variable "ip_range_services_name" {
  type        = string
  description = "The secondary ip range to use for services"
  default     = "ip-range-services"
}

variable "zones" {
  type    = list(string)
  default = ["us-central1-a", "us-central1-b"]
}

variable "google_client_id" {
  type = string
}

variable "sentry_dsn" {
  type = string
}
