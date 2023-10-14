module "faktory" {
  source = "./modules/faktory"

  password = data.google_secret_manager_secret_version.faktory_password.secret_data
}
