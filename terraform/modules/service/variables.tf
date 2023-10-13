variable "name" {
  type = string
}

variable "domain" {
  type = string
}

variable "image" {
  type = string
}

variable "port" {
  type = number
}

variable "env" {
  type = map(string)

  default = {}
}

variable "healthcheck" {
  type = object({
    path = string
  })

  default = { path = "" }
}

variable "cloud_sql_instance" {
  type = string

  default = ""
}

variable "k8s_service_account" {
  type = string
}
