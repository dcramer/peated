locals {
  cloud_sql_instance   = var.cloud_sql_instance != "" ? [var.cloud_sql_instance] : []
  cloud_sql_http_port  = 9801
  cloud_sql_admin_port = 9092
  # memory should scale based on pg pool size
  cloud_sql_memory = "512Mi"
  # cant seem to adjust this to less than 1
  cloud_sql_cpu     = "1"
  cloud_sql_storage = "1Gi"
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
    replicas = "1"

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "1"
        max_unavailable = "0"
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
            requests = {
              cpu               = var.cpu
              memory            = var.memory
              ephemeral-storage = var.ephemeral_storage
            }

            limits = {
              cpu               = var.cpu
              memory            = var.memory
              ephemeral-storage = var.ephemeral_storage
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

        # dynamic "container" {
        #   for_each = var.containers
          
        #   content {
        #     name  = container.name
        #     image = container.image


        #     dynamic "env" {
        #       for_each = var.env
        #       content {
        #         name  = env.key
        #         value = env.value
        #       }
        #     }

        #     dynamic "port" {
        #       for_each = container.value.port != 0 ? [container.value.port] : []
        #       content {
        #         container_port = port.value
        #       }
        #     }

        #     resources {
        #       requests = {
        #         cpu               = container.value.cpu
        #         memory            = container.memory
        #         ephemeral-storage = container.ephemeral_storage
        #       }

        #       limits = {
        #         cpu               = container.cpu
        #         memory            = container.memory
        #         ephemeral-storage = container.ephemeral_storage
        #       }
        #     }

        #     security_context {
        #       allow_privilege_escalation = false
        #       privileged                 = false
        #       read_only_root_filesystem  = false
        #       run_as_non_root            = false

        #       capabilities {
        #         add = []
        #         drop = [
        #           "NET_RAW"
        #         ]
        #       }
        #     }
        #   }
        # }


        # https://github.com/GoogleCloudPlatform/cloud-sql-proxy/blob/main/examples/k8s-health-check/proxy_with_http_health_check.yaml
        dynamic "container" {
          for_each = local.cloud_sql_instance
          content {
            name  = "cloud-sql-proxy"
            image = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.6.0"
            args  = [container.value]

            env {
              name  = "CSQL_PROXY_PORT"
              value = "5432"
            }

            # Enable HTTP healthchecks on port 9801. This enables /liveness,
            # /readiness and /startup health check endpoints. Allow connections
            # listen for connections on any interface (0.0.0.0) so that the
            # k8s management components can reach these endpoints.
            env {
              name  = "CSQL_PROXY_HEALTH_CHECK"
              value = "true"
            }
            env {
              name  = "CSQL_PROXY_HTTP_PORT"
              value = local.cloud_sql_http_port
            }
            env {
              name  = "CSQL_PROXY_HTTP_ADDRESS"
              value = "0.0.0.0"
            }

            # Configure the proxy to exit gracefully when sent a k8s configuration
            # file.
            env {
              name  = "CSQL_PROXY_EXIT_ZERO_ON_SIGTERM"
              value = "true"
            }

            # Enable the admin api server (which only listens for local connections)
            # and enable the /quitquitquit endpoint. This allows other pods
            # to shut down the proxy gracefully when they are ready to exit.
            env {
              name  = "CSQL_PROXY_QUITQUITQUIT"
              value = "true"
            }
            env {
              name  = "CSQL_PROXY_ADMIN_PORT"
              value = local.cloud_sql_admin_port
            }

            # Enable structured logging with LogEntry format
            env {
              name  = "CSQL_PROXY_STRUCTURED_LOGS"
              value = "true"
            }

            port {
              container_port = local.cloud_sql_http_port
              protocol       = "TCP"
            }

            # Configure kubernetes to call the /quitquitquit endpoint on the
            # admin server before sending SIGTERM to the proxy before stopping
            # the pod. This will give the proxy more time to gracefully exit.
            lifecycle {
              pre_stop {
                http_get {
                  path   = "/quitquitquit"
                  port   = local.cloud_sql_admin_port
                  scheme = "HTTP"
                }
              }
            }

            startup_probe {
              failure_threshold = 60
              http_get {
                path   = "/startup"
                port   = local.cloud_sql_http_port
                scheme = "HTTP"
              }
              period_seconds    = 1
              success_threshold = 1
              timeout_seconds   = 10
            }

            liveness_probe {
              failure_threshold = 3
              http_get {
                path   = "/liveness"
                port   = local.cloud_sql_http_port
                scheme = "HTTP"
              }
              period_seconds    = 10
              success_threshold = 1
              timeout_seconds   = 10
            }

            readiness_probe {
              http_get {
                path   = "/readiness"
                port   = local.cloud_sql_http_port
                scheme = "HTTP"
              }
              initial_delay_seconds = 10
              period_seconds        = 10
              timeout_seconds       = 10
              success_threshold     = 1
              failure_threshold     = 6
            }

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

            resources {
              requests = {
                cpu               = local.cloud_sql_cpu
                memory            = local.cloud_sql_memory
                ephemeral-storage = local.cloud_sql_storage
              }

              limits = {
                cpu               = local.cloud_sql_cpu
                memory            = local.cloud_sql_memory
                ephemeral-storage = local.cloud_sql_storage
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
