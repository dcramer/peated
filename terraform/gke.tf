data "google_client_config" "default" {}

module "gke" {
  source                          = "terraform-google-modules/kubernetes-engine/google//modules/beta-autopilot-public-cluster"
  version                         = "~> 29.0.0"
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
  version             = "~> 29.0.0"
  use_existing_gcp_sa = true
  use_existing_k8s_sa = true
  annotate_k8s_sa     = false
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
  version              = "~> 29.0.0"
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
