locals {
  cloud_sql_instance = var.cloud_sql_instance != "" ? [var.cloud_sql_instance] : []
}

resource "google_compute_global_address" "ip_address" {
  count = length(var.domains) != 0 ? 1 : 0

  name         = "${var.name}-ip"
  description  = "IP Address for ${var.name} service"
  address_type = "EXTERNAL"
}

resource "google_compute_managed_ssl_certificate" "default" {
  count = length(var.domains) != 0 ? 1 : 0

  provider = google-beta
  name     = "${var.name}-cert"

  managed {
    domains = var.domains
  }
}

# https://github.com/hashicorp/terraform-provider-kubernetes/issues/446#issuecomment-496905302
resource "kubernetes_ingress_v1" "default" {
  count = length(var.domains) != 0 ? 1 : 0

  metadata {
    name = var.name

    annotations = {
      "kubernetes.io/ingress.allow-http"            = "false",
      "ingress.gcp.kubernetes.io/pre-shared-cert"   = google_compute_managed_ssl_certificate.default[0].name
      "kubernetes.io/ingress.global-static-ip-name" = google_compute_global_address.ip_address[0].name
    }

    labels = {
      "app.kubernetes.io/name" = var.name
    }
  }

  spec {
    default_backend {
      service {
        name = var.name
        port {
          number = 80
        }
      }
    }
  }

  depends_on = [kubernetes_service_v1.default]
}

resource "kubernetes_service_v1" "default" {
  count = var.port != 0 ? 1 : 0

  metadata {
    name = var.name

    labels = {
      "app.kubernetes.io/name" = var.name
    }
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = var.name,
    }

    port {
      port        = 80
      target_port = var.port
      protocol    = "TCP"
    }

    type = "NodePort"
  }

  depends_on = [kubernetes_deployment_v1.default]

  lifecycle {
    ignore_changes = [
      metadata[0].annotations["cloud.google.com/neg"],
      metadata[0].annotations["cloud.google.com/neg-status"],
    ]
  }
}

resource "kubernetes_deployment_v1" "default" {
  metadata {
    name = var.name

    labels = {
      "app.kubernetes.io/name" = var.name
    }
  }

  wait_for_rollout = false

  spec {
    replicas = 1

    strategy {
      type = "RollingUpdate"
      rolling_update {
        # max_surge       = 2
        max_unavailable = "25%"
      }
    }

    min_ready_seconds      = 5
    revision_history_limit = 5

    selector {
      match_labels = {
        "app.kubernetes.io/name" = var.name
      }
    }

    template {
      metadata {
        name = var.name

        labels = {
          "app.kubernetes.io/name" = var.name
        }
      }
      spec {
        container {
          name  = var.name
          image = var.image


          dynamic "env" {
            for_each = var.env
            content {
              name  = env.key
              value = env.value
            }
          }

          dynamic "port" {
            for_each = var.port != 0 ? [var.port] : []
            content {
              container_port = port.value
            }
          }
          resources {
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }

          security_context {
            allow_privilege_escalation = false
            privileged                 = false
            read_only_root_filesystem  = false
            run_as_non_root            = false

            capabilities {
              add = []
              drop = [
                "NET_RAW"
              ]
            }
          }

          dynamic "liveness_probe" {
            for_each = var.port != 0 ? [var.port] : []
            content {
              http_get {
                path = var.healthcheck.path
                port = var.port
              }
              initial_delay_seconds = 30
              period_seconds        = 5
              timeout_seconds       = 5
              failure_threshold     = 6
              success_threshold     = 1
            }
          }

          dynamic "readiness_probe" {
            for_each = var.port != 0 ? [var.port] : []
            content {
              http_get {
                path = var.healthcheck.path
                port = var.port
              }
              initial_delay_seconds = 10
              period_seconds        = 5
              timeout_seconds       = 5
              failure_threshold     = 6
              success_threshold     = 1
            }
          }
        }

        dynamic "container" {
          for_each = local.cloud_sql_instance
          content {
            name  = "cloud-sql-proxy"
            image = "gcr.io/cloud-sql-connectors/cloud-sql-proxy"
            args  = ["--structured-logs", "--port=5432", container.value]

            security_context {
              allow_privilege_escalation = true
              privileged                 = false
              read_only_root_filesystem  = false
              run_as_non_root            = true

              capabilities {
                add = []
                drop = [
                  "NET_RAW"
                ]
              }
            }
          }
        }

        service_account_name = var.k8s_service_account

      }
    }
  }

  lifecycle {
    ignore_changes = [
      spec[0].template[0].spec[0].container[0].image,
      spec[0].template[0].spec[0].container[0].resources[0].limits["ephemeral-storage"],
      spec[0].template[0].spec[0].security_context,
      spec[0].template[0].spec[0].toleration,
      metadata[0].annotations["autopilot.gke.io/resource-adjustment"],
      metadata[0].annotations["autopilot.gke.io/warden-version"],
    ]
  }
}
