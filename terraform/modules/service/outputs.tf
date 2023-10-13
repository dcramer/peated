output "public_ip" {
  value = length(google_compute_global_address.ip_address) > 0 ? google_compute_global_address.ip_address[0].address : ""
}
