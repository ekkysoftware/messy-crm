# GitHub Actions -> AWS, without long-lived keys.
#
# The OIDC provider is an account-level singleton: it is created only when
# `create_github_oidc_provider` is true (the first workspace applied) and read
# through a data source everywhere else, so a second `apply` neither duplicates
# it nor fails with EntityAlreadyExists.

variable "github_repository" {
  description = "GitHub repository allowed to assume the deploy role, as owner/name."
  type        = string
  default     = "ekkysoftware/messy-crm"
}

variable "create_github_oidc_provider" {
  description = "Create the account-wide GitHub OIDC provider. True in one workspace only."
  type        = bool
  default     = false
}

data "aws_caller_identity" "current" {}

locals {
  # The GitHub environment that gates this workspace: production approvals on
  # `prod`, none on `dev`.
  github_environment = var.environment == "prod" ? "Production" : "Staging"

  # GitHub now issues ID-qualified ("immutable") subject claims alongside the
  # classic form, e.g.
  #   repo:owner@343379447/repo@1430577435:environment:Staging
  # Both are accepted: owner and repository names stay exact, only the numeric
  # ids are wildcarded, so the policy survives GitHub's rollout and a rename.
  github_subjects = [
    "repo:${var.github_repository}:environment:${local.github_environment}",
    "repo:${split("/", var.github_repository)[0]}@*/${split("/", var.github_repository)[1]}@*:environment:${local.github_environment}",
  ]
  oidc_provider_arn = (
    var.create_github_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
    : data.aws_iam_openid_connect_provider.github[0].arn
  )
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 0 : 1

  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Pinned to one environment: a job outside `Staging`/`Production` cannot
    # assume this role even if it runs in the same repository.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.github_subjects
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.project_name}-${var.environment}-gha-deploy"
  description        = "GitHub Actions deploy role for the ${var.environment} workspace."
  assume_role_policy = data.aws_iam_policy_document.github_trust.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "EcrLogin"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPushPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
    ]
    resources = [aws_ecr_repository.app.arn]
  }

  statement {
    sid     = "SendDeployCommand"
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    # SendCommand needs the document *and* the instance; the instance alone is denied.
    resources = [
      "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
      aws_instance.app.arn,
    ]
  }

  statement {
    sid     = "ReadDeployCommand"
    effect  = "Allow"
    actions = ["ssm:GetCommandInvocation"]
    # Authorized against the *command*, not the instance: scoping this to the
    # instance ARN fails with AccessDenied on a resource of
    # arn:aws:ssm:<region>:<account>:command/*
    resources = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:command/*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
