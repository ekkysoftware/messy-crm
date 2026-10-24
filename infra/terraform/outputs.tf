output "aws_region" {
  description = "Region the environment is deployed in."
  value       = var.aws_region
}

output "environment" {
  description = "Environment name, derived from the active Terraform workspace."
  value       = terraform.workspace
}

output "ecr_registry" {
  description = "Registry host the image is pushed to and pulled from."
  value       = local.ecr_registry
}

output "ecr_repository_name" {
  description = "ECR repository name (unique per workspace)."
  value       = local.ecr_repository
}

output "ecr_repository_url" {
  description = "Full ECR repository URL without a tag."
  value       = aws_ecr_repository.app.repository_url
}

output "instance_id" {
  description = "EC2 instance id of the application host (SSM target)."
  value       = aws_instance.app.id
}

output "instance_role_arn" {
  description = "IAM role the host assumes."
  value       = aws_iam_role.instance.arn
}

output "public_ip" {
  description = "Elastic IP address of the application host."
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "Public URL of the application (plain HTTP, no proxy in front)."
  value       = "http://${aws_eip.app.public_ip}"
}

output "log_group_name" {
  description = "CloudWatch log group the containers ship to."
  value       = aws_cloudwatch_log_group.app.name
}

output "deploy_role_arn" {
  description = "IAM role GitHub Actions assumes for this workspace (OIDC)."
  value       = aws_iam_role.github_deploy.arn
}

output "deploy_role_name" {
  description = "Name of the GitHub Actions deploy role."
  value       = aws_iam_role.github_deploy.name
}

output "release_role_arn" {
  description = "IAM role GitHub Actions assumes to version-tag the deployed prod image (prod workspace only)."
  value       = try(aws_iam_role.github_release[0].arn, null)
}

output "release_role_name" {
  description = "Name of the GitHub Actions release role (prod workspace only)."
  value       = try(aws_iam_role.github_release[0].name, null)
}
