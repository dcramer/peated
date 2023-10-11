resource "google_sql_database_instance" "main" {
  name             = "peated-main"
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier = "db-f1-micro"
  }

  deletion_protection = "true"
}
