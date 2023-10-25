variable "name" {
  type = string
}

variable "domains" {
  type = list(string)

  default = []
}

variable "image" {
  type = string
}

variable "port" {
  type = number

  default = 0
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

variable "memory" {
  type    = string
  default = "1Gi"
}

variable "cpu" {
  type    = string
  default = "500m"
}

variable "ephemeral_storage" {
  type    = string
  default = "1Gi"
}
