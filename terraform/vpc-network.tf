module "gcp-network" {
  source       = "terraform-google-modules/network/google"
  version      = "~> 8.1.0"
  project_id   = var.project_id
  network_name = var.network

  subnets = [
    {
      subnet_name   = var.subnet
      subnet_ip     = "10.0.0.0/16"
      subnet_region = var.region
    },
    # {
    #   subnet_name   = var.auth_subnet
    #   subnet_ip     = "10.60.0.0/17"
    #   subnet_region = var.region
    # },
  ]

  secondary_ranges = {
    (var.subnet) = [
      {
        range_name    = var.ip_range_pods_name
        ip_cidr_range = "192.168.0.0/18"
      },
      {
        range_name    = var.ip_range_services_name
        ip_cidr_range = "192.168.64.0/18"
      },
    ]
  }
}
