resource "google_sql_database_instance" "instance" {
  name             = "peated-main"
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier            = var.tier
    disk_autoresize = true

    backup_configuration {
      enabled = true
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
