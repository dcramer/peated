variable "name" {
  type = string
}

variable "region" {
  type = string
}


variable "tier" {
  type    = string
  default = "db-f1-micro"
}

variable "databases" {
  default = []
}

variable "users" {
  type    = list(map(string))
  default = []
  # Example:
  # default = [
  #   {
  #     name = var.cloud_sql_postgres_user
  #     password = data.google_secret_manager_secret_version.cloud_sql_user_password.secret_data
  #   }
  # ]
  #
}
