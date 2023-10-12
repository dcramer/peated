resource "google_sql_database_instance" "main" {
  name             = "peated-main"
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier = "db-f1-micro"
  }

  deletion_protection = "true"
}

resource "google_sql_database" "peated" {
  name     = "peated"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "peated" {
  name     = "peated"
  instance = google_sql_database_instance.main.name
  password = "peated"
}

output "sql_instance_name" {
  value = google_sql_database_instance.main.connection_name
}
