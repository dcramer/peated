resource "kubernetes_service_v1" "faktory" {
  metadata {
    name = "faktory"

    labels = {
      "app.kubernetes.io/name" = "faktory"
    }
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "faktory"
    }

    port {
      port     = 7419
      protocol = "TCP"
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_stateful_set_v1" "faktory" {
  metadata {
    name = "faktory"

    labels = {
      "app.kubernetes.io/name" = "faktory"
    }
  }

  wait_for_rollout = false

  spec {
    replicas               = 1
    revision_history_limit = 5
    service_name           = "faktory"

    update_strategy {
      type = "OnDelete"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "faktory",
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name" = "faktory"
        }
      }

      spec {
        termination_grace_period_seconds = 10
        share_process_namespace          = true

        container {
          name              = "config-watcher"
          image             = "busybox"
          image_pull_policy = "IfNotPresent"
          command = [
            "sh",
            "-c",
            <<EOT
            sum() {
                current=$(find /conf -type f -exec md5sum {} \; | sort -k 2 | md5sum)
              }
              sum
              last=\"$current\"
              while true; do
                sum
                if [ \"$current\" != \"$last\" ]; then
                  pid=$(pidof faktory)
                  echo \"$(date -Iseconds) [conf.d] changes detected - signaling Faktory with pid=$pid\"
                  kill -HUP \"$pid\"
                  last=\"$current\"
                fi
                sleep 1
              done
            EOT
          ]

          args = [
            "--volume-dir=/etc/config",
            "--webhook-url=http://localhost:9090/-/reload",
          ]

          volume_mount {
            name       = "configs"
            mount_path = "/conf"
          }
        }

        container {
          name              = "server"
          image             = "contribsys/faktory"
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

          env {
            name  = "FAKTORY_PASSWORD"
            value = "faktory"
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

          security_context {
            capabilities {
              add = ["SYS_PTRACE"]
            }
          }

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

          volume_mount {
            name       = "configs"
            mount_path = "/etc/faktory/conf.d"
          }
        }

        volume {
          name = "configs"
          config_map {
            name = "faktory"
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {}
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
            storage = "8Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_config_map_v1" "faktory" {
  metadata {
    name = "faktory"

    labels = {
      "app.kubernetes.io/name" = "faktory"
    }
  }

  data = {

  }
}
