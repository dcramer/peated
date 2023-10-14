

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

          security_context {
            capabilities {
              add = ["SYS_PTRACE"]
              drop = [
                "NET_RAW"
              ]
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
            name = var.name
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
            storage = "8Gi"
          }
        }
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

resource "kubernetes_config_map_v1" "config_map" {
  metadata {
    name = var.name

    labels = {
      "app.kubernetes.io/name" = var.name
    }
  }

  data = {

  }
}
