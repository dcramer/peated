output "connection_name" {
  value = google_sql_database_instance.instance.connection_name
}

output "host_ip" {
  value = google_sql_database_instance.instance.private_ip_address
}

output "hostname" {
  value = "${kubernetes_service_v1.service.metadata[0].name}.${kubernetes_service_v1.service.metadata[0].namespace}.svc.cluster.local"
}
