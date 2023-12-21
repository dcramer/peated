data "google_client_config" "default" {}

module "gke" {
  source                          = "terraform-google-modules/kubernetes-engine/google//modules/beta-autopilot-public-cluster"
  version                         = "~> 28.0.0"
  project_id                      = var.project_id
  name                            = var.cluster_name
  region                          = var.region
  regional                        = true
  zones                           = var.zones
  network                         = module.gcp-network.network_name
  subnetwork                      = module.gcp-network.subnets_names[index(module.gcp-network.subnets_names, var.subnet)]
  ip_range_pods                   = var.ip_range_pods_name
  ip_range_services               = var.ip_range_services_name
  release_channel                 = "REGULAR"
  http_load_balancing             = true
  horizontal_pod_autoscaling      = true
  enable_vertical_pod_autoscaling = true
  enable_cost_allocation          = true
  create_service_account          = true
  # enable_private_endpoint         = true
  # enable_private_nodes            = true
  # master_ipv4_cidr_block          = "172.16.0.0/28"

  # master_authorized_networks = [
  #   {
  #     cidr_block   = "10.60.0.0/17"
  #     display_name = "VPC"
  #   },
  # ]

  depends_on = [
    module.gcp-network
  ]
}

module "gke_workload_identity" {
  source              = "terraform-google-modules/kubernetes-engine/google//modules/workload-identity"
  version             = "~> 28.0.0"
  use_existing_gcp_sa = true
  use_existing_k8s_sa = true
  k8s_sa_name         = var.cluster_name
  cluster_name        = var.cluster_name
  location            = var.region
  gcp_sa_name         = module.gke.service_account
  name                = var.cluster_name
  project_id          = var.project_id

  # wait for the custom GSA to be created to force module data source read during apply
  # https://github.com/terraform-google-modules/terraform-google-kubernetes-engine/issues/1059
  depends_on = [module.gke]
}

module "gke_auth" {
  source               = "terraform-google-modules/kubernetes-engine/google//modules/auth"
  version              = "~> 28.0.0"
  project_id           = var.project_id
  location             = module.gke.location
  cluster_name         = module.gke.name
  use_private_endpoint = true
  depends_on           = [module.gke]
}

resource "local_file" "kubeconfig" {
  content  = module.gke_auth.kubeconfig_raw
  filename = "kubeconfig"
}

output "service_account" {
  value = module.gke.service_account
}

# output "cluster_id" {
#   description = "Cluster ID"
#   value       = module.gke.cluster_id
# }

# output "Cluster_name" {
#   description = "Cluster name"
#   value       = module.gke.name
# }

# output "Cluster_type" {
#   description = "Cluster type (regional / zonal)"
#   value       = module.gke.type
# }

# output "Cluster_location" {
#   description = "Cluster location (region if regional cluster, zone if zonal cluster)"
#   value       = module.gke.location
# }

# output "Cluster_region" {
#   description = "Cluster region"
#   value       = module.gke.region
# }

# output "Cluster_zones" {
#   description = "List of zones in which the cluster resides"
#   value       = module.gke.zones
# }

# output "Cluster_endpoint" {
#   sensitive   = true
#   description = "Cluster endpoint"
#   value       = module.gke.endpoint
# }

# output "min_master_version" {
#   description = "Minimum master kubernetes version"
#   value       = module.gke.min_master_version
# }

# output "logging_service" {
#   description = "Logging service used"
#   value       = module.gke.logging_service
# }

# output "monitoring_service" {
#   description = "Monitoring service used"
#   value       = module.gke.monitoring_service
# }

# output "master_authorized_networks_config" {
#   description = "Networks from which access to master is permitted"
#   value       = module.gke.master_authorized_networks_config
# }

# output "master_version" {
#   description = "Current master kubernetes version"
#   value       = module.gke.master_version
# }

# output "ca_certificate" {
#   sensitive   = true
#   description = "Cluster ca certificate (base64 encoded)"
#   value       = module.gke.ca_certificate
# }

# output "network_policy_enabled" {
#   description = "Whether network policy enabled"
#   value       = module.gke.network_policy_enabled
# }

# output "http_load_balancing_enabled" {
#   description = "Whether http load balancing enabled"
#   value       = module.gke.http_load_balancing_enabled
# }

# output "horizontal_pod_autoscaling_enabled" {
#   description = "Whether horizontal pod autoscaling enabled"
#   value       = module.gke.horizontal_pod_autoscaling_enabled
# }

# output "node_pools_names" {
#   description = "List of node pools names"
#   value       = module.gke.node_pools_names
# }

# output "node_pools_versions" {
#   description = "Node pool versions by node pool name"
#   value       = module.gke.node_pools_versions
# }

# output "service_account" {
#   description = "The service account to default running nodes as if not overridden in `node_pools`."
#   value       = module.gke.service_account
# }
