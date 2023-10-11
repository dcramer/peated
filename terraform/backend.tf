terraform {
  backend "gcs" {
    bucket = "peated-tfstate"
    prefix = "terraform/state"
  }
}
