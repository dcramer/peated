# import {
#   id = "sentry_auth_token"
#   to = google_secret_manager_secret.sentry_auth_token
# }

# resource "google_secret_manager_secret" "sentry_auth_token" {
#   secret_id = "sentry_auth_token"
#   replication {
#     auto {}
#   }
# }

# import {
#   id = "projects/${var.project_id}/secrets/${google_secret_manager_secret.sentry_auth_token.name}/versions/0"
#   to = google_secret_manager_secret_version.sentry_auth_token
# }

# resource "google_secret_manager_secret_version" "sentry_auth_token" {
#   secret      = google_secret_manager_secret.sentry_auth_token.name
#   secret_data = "secret-data"
# }

# import {
#   id = "sentry_auth_token"
#   to = google_secret_manager_secret_iam_member.sentry_auth_token
# }

# resource "google_secret_manager_secret_iam_member" "sentry_auth_token" {
#   secret_id  = google_secret_manager_secret.sentry_auth_token.id
#   role       = "roles/secretmanager.secretAccessor"
#   member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
#   depends_on = [google_secret_manager_secret.sentry_auth_token]
# }

