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

resource "google_secret_manager_secret" "google_client_secret" {
  secret_id = "google_client_secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "google_client_secret" {
  secret_id  = google_secret_manager_secret.google_client_secret.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_secret_manager_secret.google_client_secret]
}

data "google_secret_manager_secret_version" "google_client_secret" {
  provider = google-beta

  secret = google_secret_manager_secret.google_client_secret.id
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt_secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "jwt_secret" {
  secret_id  = google_secret_manager_secret.jwt_secret.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_secret_manager_secret.jwt_secret]
}

data "google_secret_manager_secret_version" "jwt_secret" {
  provider = google-beta

  secret = google_secret_manager_secret.jwt_secret.id
}

resource "google_secret_manager_secret" "faktory_password" {
  secret_id = "faktory_password"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "faktory_password" {
  secret_id  = google_secret_manager_secret.faktory_password.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_secret_manager_secret.faktory_password]
}

data "google_secret_manager_secret_version" "faktory_password" {
  provider = google-beta

  secret = google_secret_manager_secret.faktory_password.id
}

resource "google_secret_manager_secret" "api_access_token" {
  secret_id = "api_access_token"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "api_access_token" {
  secret_id  = google_secret_manager_secret.api_access_token.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_secret_manager_secret.api_access_token]
}

data "google_secret_manager_secret_version" "api_access_token" {
  provider = google-beta

  secret = google_secret_manager_secret.api_access_token.id
}

resource "google_secret_manager_secret" "discord_webhook" {
  secret_id = "discord_webhook"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "discord_webhook" {
  secret_id  = google_secret_manager_secret.discord_webhook.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_secret_manager_secret.discord_webhook]
}

data "google_secret_manager_secret_version" "discord_webhook" {
  provider = google-beta

  secret = google_secret_manager_secret.discord_webhook.id
}
