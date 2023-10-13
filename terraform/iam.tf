resource "google_service_account_iam_binding" "peated-repository-iam" {
  service_account_id = google_service_account.github.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/dcramer/peated"
  ]
}

resource "google_service_account" "github" {
  account_id   = "github"
  project      = data.google_project.project.project_id
  display_name = "GitHub"
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = data.google_project.project.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_project_iam_binding" "read-write-registry-iam" {
  project = data.google_project.project.project_id
  role    = "roles/artifactregistry.writer"
  members = ["serviceAccount:${google_service_account.github.email}"]
}

resource "google_project_iam_binding" "read-registry-iam" {
  project = data.google_project.project.project_id
  role    = "roles/artifactregistry.reader"
  members = ["serviceAccount:${module.gke.service_account}"]
}

resource "google_artifact_registry_repository_iam_binding" "peated" {
  repository = google_artifact_registry_repository.peated.name
  location   = var.region
  role       = "roles/artifactregistry.writer"
  project    = var.project_id

  members = [
    "serviceAccount:service-${data.google_project.project.number}@serverless-robot-prod.iam.gserviceaccount.com"
  ]
}

resource "google_project_iam_binding" "cloud-run-developer-iam" {
  project = data.google_project.project.project_id
  role    = "roles/run.developer"
  members = ["serviceAccount:${google_service_account.github.email}"]
}

resource "google_project_iam_binding" "cloud-run-service-agent-iam" {
  project = data.google_project.project.project_id
  role    = "roles/run.serviceAgent"
  members = ["serviceAccount:${google_service_account.github.email}", "serviceAccount:service-${data.google_project.project.number}@serverless-robot-prod.iam.gserviceaccount.com"]
}


resource "google_project_iam_binding" "service-account-user-iam" {
  project = data.google_project.project.project_id
  role    = "roles/iam.serviceAccountUser"
  members = ["serviceAccount:service-${data.google_project.project.number}@serverless-robot-prod.iam.gserviceaccount.com"]
}

resource "google_project_iam_binding" "container-developer-iam" {
  project = data.google_project.project.project_id
  role    = "roles/container.developer"
  members = ["serviceAccount:${google_service_account.github.email}"]
}


resource "google_project_iam_binding" "cloud-sql-client-iam" {
  project = data.google_project.project.project_id
  role    = "roles/cloudsql.client"
  members = ["serviceAccount:${module.gke.service_account}"]
}

resource "google_project_iam_binding" "storage-object-user-iam" {
  project = data.google_project.project.project_id
  role    = "roles/storage.objectUser"
  members = ["serviceAccount:${module.gke.service_account}"]
}

