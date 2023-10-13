locals {
  cloud_sql_instance = var.cloud_sql_instance != "" ? [var.cloud_sql_instance] : []
}

resource "google_compute_managed_ssl_certificate" "default" {
  provider = google-beta
  name     = "${var.name}-cert"

  managed {
    domains = [var.domain]
  }
}

resource "kubernetes_ingress_v1" "default" {
  metadata {
    name = var.name

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
      hosts       = [var.domain]
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

          liveness_probe {
            http_get {
              path = var.healthcheck.path
              port = var.port
            }
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
              run_as_non_root = true
            }
          }
        }

        service_account_name = var.k8s_service_account

      }
    }
  }
}
