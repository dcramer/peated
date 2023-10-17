module "dns-private-zone" {
  source     = "terraform-google-modules/cloud-dns/google"
  version    = "~> 5.1.0"
  project_id = var.project_id
  type       = "public"
  name       = "peated-app"
  domain     = "peated.app."

  recordsets = [
    # FLY
    # {
    #   name = ""
    #   type = "A"
    #   ttl  = 300
    #   records = [
    #     "66.241.124.159",
    #   ]
    # },
    # {
    #   name = ""
    #   type = "AAAA"
    #   ttl  = 300
    #   records = [
    #     "2a09:8280:1::1c:172b",
    #   ]
    # },
    # {
    #   name = "api"
    #   type = "A"
    #   ttl  = 300
    #   records = [
    #     "66.241.124.195",
    #   ]
    # },
    # {
    #   name = "api"
    #   type = "AAAA"
    #   ttl  = 300
    #   records = [
    #     "2a09:8280:1::42:17c8",
    #   ]
    # },
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
        module.api-service.public_ip,
      ]
    },
    {
      name = ""
      type = "A"
      ttl  = 300
      records = [
        module.web-service.public_ip,
      ]
    },
    {
      name = "api.staging"
      type = "A"
      ttl  = 300
      records = [
        module.api-service.public_ip,
      ]
    },
    {
      name = "staging"
      type = "A"
      ttl  = 300
      records = [
        module.web-service.public_ip,
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
        module.api-service.public_ip,
      ]
    },
    {
      name = ""
      type = "A"
      ttl  = 300
      records = [
        module.web-service.public_ip,
      ]
    },
    {
      name = "api.staging"
      type = "A"
      ttl  = 300
      records = [
        module.api-service.public_ip,
      ]
    },
    {
      name = "staging"
      type = "A"
      ttl  = 300
      records = [
        module.web-service.public_ip,
      ]
    },
  ]
}
