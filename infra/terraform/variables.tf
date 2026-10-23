variable "project_name" {
  description = "Project name used as the prefix for resource names and for the Project tag."
  type        = string
}

variable "aws_region" {
  description = "AWS region every resource is created in."
  type        = string
  default     = "ap-southeast-3"
}

variable "environment" {
  description = "Environment name, expected to match the active Terraform workspace (e.g. dev, prod)."
  type        = string
  default     = "prod"
}

variable "instance_type" {
  description = "EC2 instance type for the application host."
  type        = string
  default     = "t3.small"
}

variable "app_ingress_cidr" {
  description = "CIDR block allowed to reach the application port (80)."
  type        = string
  default     = "0.0.0.0/0"
}

variable "data_volume_size_gb" {
  description = "Size in GiB of the encrypted gp3 EBS volume that holds PostgreSQL data."
  type        = number
  default     = 20
}

variable "log_retention_days" {
  description = "Retention period in days for the application CloudWatch log group."
  type        = number
  default     = 14
}

variable "compose_version" {
  description = "Pinned Docker Compose v2 plugin version installed on the host."
  type        = string
  default     = "2.32.4"
}

variable "image_tag" {
  description = "Image tag the host runs until a deploy switches it; 'bootstrap' is the pre-first-push placeholder."
  type        = string
  default     = "bootstrap"
}
