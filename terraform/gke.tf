data "google_client_config" "default" {}


module "gke_workload_identity" {
  source              = "terraform-google-modules/kubernetes-engine/google//modules/workload-identity"
  version             = "~> 29.0.0"
  k8s_sa_name         = var.cluster_name
  gcp_sa_name         = "gke-${var.cluster_name}"
  use_existing_k8s_sa = true
  # use_existing_gcp_sa = true
  cluster_name        = var.cluster_name
  location            = var.region
  name                = var.cluster_name
  project_id          = var.project_id
  roles               = ["roles/container.nodeServiceAccount", "roles/storage.objectUser", "roles/artifactregistry.reader", "roles/cloudsql.client"]
}

module "gke" {
  source                          = "terraform-google-modules/kubernetes-engine/google//modules/beta-public-cluster"
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
  horizontal_pod_autoscaling      = false
  enable_vertical_pod_autoscaling = false
  enable_cost_allocation          = true
  create_service_account          = false
  filestore_csi_driver            = true
  service_account_name            = "gke-${var.cluster_name}"
  # enable_private_endpoint         = true
  # enable_private_nodes            = true
  # master_ipv4_cidr_block          = "172.16.0.0/28"

  # master_authorized_networks = [
  #   {
  #     cidr_block   = "10.60.0.0/17"
  #     display_name = "VPC"
  #   },
  # ]

  node_pools = [
    {
      name                      = "default-node-pool"
      machine_type              = "e2-highcpu-2"
      node_locations            = "us-central1-b,us-central1-c"
      min_count                 = 1
      max_count                 = 2
      local_ssd_count           = 0
      spot                      = false
      local_ssd_ephemeral_count = 0
      disk_size_gb              = 10
      disk_type                 = "pd-standard"
      image_type                = "COS_CONTAINERD"
      enable_gcfs               = false
      enable_gvnic              = false
      logging_variant           = "DEFAULT"
      auto_repair               = true
      auto_upgrade              = true
      # service_account           = "gke-node-sa@${data.google_project.project.number}.iam.gserviceaccount.com"
      preemptible               = false
      initial_node_count        = 1
    },
  ]

  node_pools_labels = {
    all = {}

    default-node-pool = {
      default-node-pool = true
    }
  }

  node_pools_metadata = {
    all = {}

    default-node-pool = {
      node-pool-metadata-custom-value = "default-node-pool"
    }
  }

  node_pools_taints = {
    all = []

    default-node-pool = [
      {
        key    = "default-node-pool"
        value  = true
        effect = "PREFER_NO_SCHEDULE"
      },
    ]
  }

  node_pools_tags = {
    all = []

    default-node-pool = [
      "default-node-pool",
    ]
  }

  depends_on = [
    module.gcp-network,
  ]
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
  value = "gke-${var.cluster_name}@${var.project_id}.iam.gserviceaccount.com"
}
