resource "kubernetes_service_v1" "ui" {
  metadata {
    name = "${var.name}-ui"

    labels = {
      "app.kubernetes.io/name" = var.name
    }
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = var.name
    }

    port {
      port        = var.ui_port
      target_port = 7420
      protocol    = "TCP"
    }

    type = "LoadBalancer"
  }

  lifecycle {
    ignore_changes = [
      metadata[0].annotations["cloud.google.com/neg"],
      metadata[0].annotations["cloud.google.com/neg-status"],
    ]
  }
}

resource "kubernetes_service_v1" "service" {
  metadata {
    name = var.name

    labels = {
      "app.kubernetes.io/name" = var.name
    }
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = var.name
    }

    port {
      port        = var.port
      target_port = 7419
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  lifecycle {
    ignore_changes = [
      metadata[0].annotations["cloud.google.com/neg"],
      metadata[0].annotations["cloud.google.com/neg-status"],
    ]
  }
}

resource "kubernetes_stateful_set_v1" "stateful_set" {
  metadata {
    name = var.name

    labels = {
      "app.kubernetes.io/name" = var.name
    }
  }

  wait_for_rollout = false

  spec {
    replicas               = 1
    revision_history_limit = 5
    service_name           = var.name

    update_strategy {
      type = "OnDelete"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name" = var.name,
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name" = var.name
        }
      }

      spec {
        termination_grace_period_seconds = 10
        # share_process_namespace          = true

        container {
          name              = "server"
          image             = "contribsys/faktory:1.8.0"
          image_pull_policy = "IfNotPresent"

          command = [
            "/faktory",
            "-b",
            ":7419",
            "-w",
            ":7420",
            "-e",
            "production"
          ]

          resources {
            limits = {
              cpu               = var.cpu
              memory            = var.memory
              ephemeral-storage = var.ephemeral_storage
            }
          }

          env {
            name  = "FAKTORY_PASSWORD"
            value = var.password
          }

          port {
            container_port = 7419
            name           = "server"
            protocol       = "TCP"
          }

          port {
            container_port = 7420
            name           = "ui"
          }

          # security_context {
          #   capabilities {
          #     add = ["SYS_PTRACE"]
          #     drop = [
          #       "NET_RAW"
          #     ]
          #   }
          # }

          liveness_probe {
            tcp_socket {
              port = "server"
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 6
            success_threshold     = 1
          }

          readiness_probe {
            tcp_socket {
              port = "server"
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 6
            success_threshold     = 1
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/faktory"
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            read_only = false
          }
        }
      }

    }

    volume_claim_template {
      metadata {
        name = "data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = "standard"

        resources {
          requests = {
            storage = "1Gi"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      spec[0].template[0].spec[0].toleration,
    ]
  }
}
