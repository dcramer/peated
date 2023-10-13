output "connection_name" {
  value = google_sql_database_instance.instance.connection_name
}

output "host_ip" {
  value = google_sql_database_instance.instance.private_ip_address
}
