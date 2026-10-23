# Secret *containers* only: values are written by scripts/set-secrets.sh.
#
# A Terraform-managed secret version would put the plaintext into
# terraform.tfstate, which the aws-deployment spec forbids. The cost is that
# Terraform cannot produce a fully configured host in one apply: the host's
# configure.sh fails loudly until set-secrets.sh has run.

resource "aws_secretsmanager_secret" "django" {
  name        = "${var.project_name}/${var.environment}/django"
  description = "Django secret key for ${local.app_name}."

  # No recovery window: `terraform destroy` must delete the container right
  # away, and re-applying into the same account must not collide with a
  # pending-deletion name.
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret" "db" {
  name        = "${var.project_name}/${var.environment}/db"
  description = "PostgreSQL superuser password for ${local.app_name}."

  recovery_window_in_days = 0
}

data "aws_iam_policy_document" "secrets_read" {
  statement {
    sid       = "ReadDeploymentSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.django.arn, aws_secretsmanager_secret.db.arn]
  }
}

resource "aws_iam_role_policy" "secrets_read" {
  name   = "secrets-read"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.secrets_read.json
}
