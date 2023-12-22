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
  default = "256Mi"
}

variable "cpu" {
  type    = string
  default = "100m"
}

variable "ephemeral_storage" {
  type    = string
  default = "1Gi"
}


# variable "containers" {
#   type = list(object({
#     name = string
#     image = string
#     port = number
#     cpu = string
#     memory = string
#     storage = string
#   }))

#   default = []
# }
