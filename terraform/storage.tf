resource "google_storage_bucket" "peated" {
  name                        = "peated"
  location                    = "US"
  uniform_bucket_level_access = true

  cors {
    origin          = ["https://peated.app", "https://peated.com"]
    method          = ["GET"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  timeouts {}
}

resource "google_storage_bucket" "peated-backups" {
  name                        = "peated-backups"
  location                    = "US"
  uniform_bucket_level_access = true
}
