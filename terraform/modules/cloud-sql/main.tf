locals {
  cloud_sql_http_port  = 9801
  cloud_sql_admin_port = 9092
  # memory should scale based on pg pool size
  cloud_sql_memory = "512Mi"
  # cant seem to adjust this to less than 1
  cloud_sql_cpu     = "1"
  cloud_sql_storage = "1Gi"
  cloud_sql_port = 25432

  pgbouncer_image = "edoburu/pgbouncer"
  pgbouncer_memory = "512Mi"
  pgbouncer_cpu = "250m"

  pgbouncer_port = 5432
  pgbouncer_default_pool_size  = 20
  pgbouncer_max_db_connections = 0
  pgbouncer_max_client_conn    = 100
  pgbouncer_pool_mode          = "transaction"
}

resource "google_sql_database_instance" "instance" {
  name             = var.name
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier                        = var.tier
    disk_autoresize             = true
    availability_type           = "ZONAL"
    deletion_protection_enabled = true

    backup_configuration {
      enabled = true
      # point_in_time_recovery_enabled  = true
    }

    maintenance_window {
      day          = 7
      hour         = 23
      update_track = "stable"
    }
  }

  deletion_protection = "true"
}

resource "google_sql_database" "databases" {
  count    = length(var.databases)
  instance = google_sql_database_instance.instance.name
  name     = var.databases[count.index]
}

resource "google_sql_user" "users" {
  count    = length(var.users)
  instance = google_sql_database_instance.instance.name
  name     = var.users[count.index].name
  password = var.users[count.index].password
}

resource "kubernetes_service_v1" "service" {
  metadata {
    name = "${var.name}-pgbouncer"

    labels = {
      "app.kubernetes.io/name" = "${var.name}-pgbouncer"
    }
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "${var.name}-pgbouncer"
    }

    port {
      port        = 5432
      target_port = 5432
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

resource "kubernetes_deployment_v1" "default" {
  metadata {
    name = "${var.name}-pgbouncer"

    labels = {
      "app.kubernetes.io/name" = "${var.name}-pgbouncer"
    }
    
    // HACK: redeploy on config changes
    // https://github.com/hashicorp/terraform-provider-kubernetes/issues/737
    annotations = {
      config_change = sha1(jsonencode(merge(
        kubernetes_config_map_v1.default.data,
      )))
    }
  }

  wait_for_rollout = false

  spec {
    replicas = "1"

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "${var.name}-pgbouncer"
      }
    }

    template {
      metadata {
        name = "${var.name}-pgbouncer"

        labels = {
          "app.kubernetes.io/name" = "${var.name}-pgbouncer"
        }
      }

      spec {
        service_account_name = var.k8s_service_account

        volume {
          name = "${var.name}-pgbouncer"
          config_map {
            name = "${var.name}-pgbouncer"
          }
        }

        container {
          name  = "pgbouncer"
          image = local.pgbouncer_image

          port {
            container_port = local.pgbouncer_port
          }

          volume_mount {
            name       = "${var.name}-pgbouncer"
            mount_path = "/etc/pgbouncer/"
            read_only = true
          }

          resources {
            limits = {
              cpu               = local.pgbouncer_cpu
              memory            = local.pgbouncer_memory
            }
          }

          readiness_probe {
            tcp_socket {
              port = local.pgbouncer_port
            }
            initial_delay_seconds = 10
            period_seconds = 5
          }

          liveness_probe {
            tcp_socket {
              port = local.pgbouncer_port
            }
            initial_delay_seconds = 20
            period_seconds = 5
          }

          # lifecycle {
          #   pre_stop {
          #     exec {
          #       command = ["sh", "-c", "sleep 180"]
          #     }
          #   }
          # }

          # security_context {
          #   allow_privilege_escalation = true
          #   privileged                 = false
          #   read_only_root_filesystem  = false
          #   run_as_non_root            = true

          #   # capabilities {
          #   #   add = []
          #   #   drop = [
          #   #     "NET_RAW"
          #   #   ]
          #   # }
          # }
        }

        # https://github.com/GoogleCloudPlatform/cloud-sql-proxy/blob/main/examples/k8s-health-check/proxy_with_http_health_check.yaml
        container {
          name  = "cloud-sql-proxy"
          image = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.8.1"
          args  = [google_sql_database_instance.instance.connection_name]

          env {
            name  = "CSQL_PROXY_PORT"
            value = local.cloud_sql_port
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
            limits = {
              cpu               = local.cloud_sql_cpu
              memory            = local.cloud_sql_memory
              ephemeral-storage = local.cloud_sql_storage
            }
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


resource "kubernetes_config_map_v1" "default" {
  metadata {
    name = "${var.name}-pgbouncer"

    labels = {
      "app.kubernetes.io/name" = "${var.name}-pgbouncer"
    }
  }

  data = {
    "userlist.txt": templatefile("${path.module}/templates/userlist.txt.tmpl", { users = var.users })
    "pgbouncer.ini": templatefile(
      "${path.module}/templates/pgbouncer.ini.tmpl",
      {
        port = local.pgbouncer_port
        default_pool_size  = local.pgbouncer_default_pool_size
        max_db_connections = local.pgbouncer_max_db_connections
        max_client_conn    = local.pgbouncer_max_client_conn
        pool_mode          = local.pgbouncer_pool_mode
        db_port            = local.cloud_sql_port
      }
    )
  }
}

