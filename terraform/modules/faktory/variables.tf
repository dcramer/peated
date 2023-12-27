variable "name" {
  type    = string
  default = "faktory"
}

variable "password" {
  type    = string
  default = "faktory"
}

variable "port" {
  type    = number
  default = 7419
}

variable "ui_port" {
  type    = number
  default = 7420
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
