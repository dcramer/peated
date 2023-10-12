resource "google_cloud_run_v2_service" "web" {
  name     = "web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = 2
    }

    containers {
      image = "us-central1-docker.pkg.dev/${data.google_project.project.project_id}/${google_artifact_registry_repository.peated.name}/web"

      ports {
        container_port = 3000
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  timeouts {}

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }
}

resource "google_cloud_run_service_iam_binding" "web" {
  location = google_cloud_run_v2_service.web.location
  service  = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  members = [
    "allUsers"
  ]
}

# Load Balancer
resource "google_compute_global_address" "web" {
  name = "web-ip"
}

resource "google_compute_managed_ssl_certificate" "web" {
  provider = google-beta
  name     = "peated-cert"

  managed {
    domains = ["peated.app"]
  }
}

resource "google_compute_region_network_endpoint_group" "web" {
  provider              = google-beta
  name                  = "peated-web"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.web.name
  }
}

resource "google_compute_backend_service" "web" {
  name                  = "web-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.web.id
  }
}

resource "google_compute_url_map" "web" {
  name            = "web-urlmap"
  default_service = google_compute_backend_service.web.id
}

resource "google_compute_target_https_proxy" "web" {
  provider = google-beta
  name     = "web-https-proxy"
  url_map  = google_compute_url_map.web.id
  ssl_certificates = [
    google_compute_managed_ssl_certificate.web.name
  ]
  depends_on = [
    google_compute_managed_ssl_certificate.web
  ]
}

resource "google_compute_global_forwarding_rule" "web_https" {
  name                  = "web-https"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  ip_protocol = "TCP"
  port_range  = "443"
  target      = google_compute_target_https_proxy.web.id
  ip_address  = google_compute_global_address.web.id
}

resource "google_compute_url_map" "web_https_redirect" {
  name = "web-https-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "web_https_redirect" {
  name    = "web-http-proxy"
  url_map = google_compute_url_map.web_https_redirect.id
}

resource "google_compute_global_forwarding_rule" "web_https_redirect" {
  name = "web-lb-http"

  target     = google_compute_target_http_proxy.web_https_redirect.id
  port_range = "80"
  ip_address = google_compute_global_address.web.address
}

output "web_ip" {
  value = google_compute_global_address.web.address
}
# /Load Balancer
