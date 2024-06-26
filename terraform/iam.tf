resource "google_project_iam_binding" "service-account-user-iam" {
  project = data.google_project.project.project_id
  role    = "roles/iam.serviceAccountUser"
  members = ["serviceAccount:service-${data.google_project.project.number}@serverless-robot-prod.iam.gserviceaccount.com"]
}
