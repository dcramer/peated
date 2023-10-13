locals {
  cloud_sql_instance = var.cloud_sql_instance != "" ? [var.cloud_sql_instance] : []
}

resource "google_compute_global_address" "ip_address" {
  name         = "${var.name}-ip"
  description  = "IP Address for ${var.name} service"
  address_type = "EXTERNAL"
}


resource "google_compute_managed_ssl_certificate" "default" {
  provider = google-beta
  name     = "${var.name}-cert"

  managed {
    domains = var.domains
  }
}

resource "kubernetes_ingress_v1" "default" {
  metadata {
    name = var.name

    annotations = {
      "kubernetes.io/ingress.global-static-ip-name" = google_compute_global_address.ip_address.name
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
    tls {
      hosts       = var.domains
      secret_name = google_compute_managed_ssl_certificate.default.name
    }
  }

  depends_on = [kubernetes_service_v1.default]
}

resource "kubernetes_service_v1" "default" {
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
        max_surge       = 4
        max_unavailable = 1
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

          port {
            container_port = var.port
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

          liveness_probe {
            http_get {
              path = var.healthcheck.path
              port = var.port
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 6
            success_threshold     = 1
          }

          readiness_probe {
            http_get {
              path = var.healthcheck.path
              port = var.port
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 6
            success_threshold     = 1
          }

          #   volume_mount {
          #     name       = "cloudsql"
          #     mount_path = "/cloudsql"
          #   }
        }

        # TODO: make this an arg
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
