
resource "google_project_iam_member" "default" {
  project = data.google_project.project.project_id
  role    = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member  = "serviceAccount:service-${data.google_project.project.number}@gs-project-accounts.iam.gserviceaccount.com"
}

resource "google_kms_key_ring" "terraform_state" {
  name     = "peated-tfstate"
  location = var.region
}

resource "google_kms_crypto_key" "terraform_state_bucket" {
  name            = "peated-tfstate"
  key_ring        = google_kms_key_ring.terraform_state.id
  rotation_period = "86400s"

  lifecycle {
    prevent_destroy = false
  }
}
resource "google_storage_bucket" "tfstate" {
  name          = "peated-tfstate"
  force_destroy = false
  location      = var.region
  storage_class = "STANDARD"
  versioning {
    enabled = true
  }
  encryption {
    default_kms_key_name = google_kms_crypto_key.terraform_state_bucket.id
  }
  depends_on = [
    google_project_iam_member.default
  ]
}
