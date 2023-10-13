# resource "google_secret_manager_secret" "sentry_auth_token" {
#   secret_id = "sentry_auth_token"
#   replication {
#     auto {}
#   }
# }

# resource "google_secret_manager_secret_version" "sentry_auth_token" {
#   secret      = google_secret_manager_secret.sentry_auth_token.name
#   secret_data = "secret-data"
# }

# resource "google_secret_manager_secret_iam_member" "sentry_auth_token" {
#   secret_id  = google_secret_manager_secret.sentry_auth_token.id
#   role       = "roles/secretmanager.secretAccessor"
#   member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
#   depends_on = [google_secret_manager_secret.sentry_auth_token]
# }

resource "google_secret_manager_secret" "session_secret" {
  secret_id = "session_secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "session_secret" {
  secret_id  = google_secret_manager_secret.session_secret.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_secret_manager_secret.session_secret]
}

# https://stackoverflow.com/questions/68941378/terraform-create-k8s-secret-from-gcp-secret
data "google_secret_manager_secret_version" "session_secret" {
  provider = google-beta

  secret = google_secret_manager_secret.session_secret.id
}

resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "openai_api_key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "openai_api_key" {
  secret_id  = google_secret_manager_secret.openai_api_key.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_secret_manager_secret.openai_api_key]
}

data "google_secret_manager_secret_version" "openai_api_key" {
  provider = google-beta

  secret = google_secret_manager_secret.openai_api_key.id
}
