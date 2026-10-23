terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

locals {
  # Resource name prefix shared by every resource: <project>-<environment>.
  app_name = "${var.project_name}-${var.environment}"
}
