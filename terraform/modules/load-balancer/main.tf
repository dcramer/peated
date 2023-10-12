resource "google_compute_global_address" "default" {
  name = "${var.name}-ip"
}

resource "google_compute_managed_ssl_certificate" "default" {
  provider = google-beta
  name     = "${var.name}-cert"

  managed {
    domains = [var.domain]
  }
}

resource "google_compute_region_network_endpoint_group" "default" {
  provider              = google-beta
  name                  = "${var.name}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = var.cloud_run_service
  }
}

resource "google_compute_backend_service" "default" {
  name                  = "${var.name}-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.default.id
  }
}

resource "google_compute_url_map" "default" {
  name            = "${var.name}-urlmap"
  default_service = google_compute_backend_service.default.id
}

resource "google_compute_target_https_proxy" "default" {
  provider = google-beta
  name     = "${var.name}-https-proxy"
  url_map  = google_compute_url_map.default.id
  ssl_certificates = [
    google_compute_managed_ssl_certificate.default.name
  ]
  depends_on = [
    google_compute_managed_ssl_certificate.default
  ]
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${var.name}-https"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  ip_protocol = "TCP"
  port_range  = "443"
  target      = google_compute_target_https_proxy.default.id
  ip_address  = google_compute_global_address.default.id
}

resource "google_compute_url_map" "https_redirect" {
  name = "${var.name}-https-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "https_redirect" {
  name    = "${var.name}-http-proxy"
  url_map = google_compute_url_map.https_redirect.id
}

resource "google_compute_global_forwarding_rule" "https_redirect" {
  name = "${var.name}-https-redirect"

  target     = google_compute_target_http_proxy.https_redirect.id
  port_range = "80"
  ip_address = google_compute_global_address.default.address
}

output "ip" {
  value = google_compute_global_address.default.address
}
