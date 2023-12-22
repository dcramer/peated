output "faktory_url" {
  value = "tcp://:${var.password}@${kubernetes_service_v1.service.metadata[0].name}.${kubernetes_service_v1.service.metadata[0].namespace}.svc.cluster.local:${var.port}"
}

output "hostname" {
  value = "${kubernetes_service_v1.service.metadata[0].name}.${kubernetes_service_v1.service.metadata[0].namespace}.svc.cluster.local"
}
