module "dns-private-zone" {
  source     = "terraform-google-modules/cloud-dns/google"
  version    = "~> 5.1.0"
  project_id = var.project_id
  type       = "public"
  name       = "peated-app"
  domain     = "peated.app."

  recordsets = [
    {
      name = "www"
      type = "CNAME"
      ttl  = 3600
      records = [
        "peated.app.",
      ]
    },
    {
      name = "api"
      type = "A"
      ttl  = 300
      records = [
        module.peated-api-service.public_ip,
      ]
    },
    {
      name = ""
      type = "A"
      ttl  = 300
      records = [
        module.peated-web-service.public_ip,
      ]
    },
    {
      name = "api.staging"
      type = "A"
      ttl  = 300
      records = [
        module.peated-api-service.public_ip,
      ]
    },
    {
      name = "staging"
      type = "A"
      ttl  = 300
      records = [
        module.peated-web-service.public_ip,
      ]
    },
  ]
}


module "peated-com-dns" {
  source     = "terraform-google-modules/cloud-dns/google"
  version    = "~> 5.1.0"
  project_id = var.project_id
  type       = "public"
  name       = "peated-com"
  domain     = "peated.com."

  recordsets = [
    {
      name = "www"
      type = "CNAME"
      ttl  = 3600
      records = [
        "peated.com.",
      ]
    },
    {
      name = "api"
      type = "A"
      ttl  = 300
      records = [
        module.peated-api-service.public_ip,
      ]
    },
    {
      name = ""
      type = "A"
      ttl  = 300
      records = [
        module.peated-web-service.public_ip,
      ]
    },
    {
      name = "api.staging"
      type = "A"
      ttl  = 300
      records = [
        module.peated-api-service.public_ip,
      ]
    },
    {
      name = "staging"
      type = "A"
      ttl  = 300
      records = [
        module.peated-web-service.public_ip,
      ]
    },
    {
      name    = ""
      type    = "TXT"
      ttl     = 300
      records = ["google-site-verification=bRxlC-JuhxpEKARMO_ZNjL9K33sldCsa--KZQrOOEFg"]
    }
  ]
}
