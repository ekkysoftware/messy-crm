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

variable "source_environment" {
  description = "Environment whose validated image the prod workspace promotes."
  type        = string
  default     = "dev"
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

  # The release job has no environment gate: it only adds a version tag to an
  # image that already passed the Production approval, so pinning the trust to
  # `main` (which is protected) is enough.
  github_release_subjects = [
    "repo:${var.github_repository}:ref:refs/heads/main",
    "repo:${split("/", var.github_repository)[0]}@*/${split("/", var.github_repository)[1]}@*:ref:refs/heads/main",
  ]

  # Promotion reads the image `dev` validated; the repository lives in the same
  # account and region but is owned by the `dev` workspace, so its ARN cannot be
  # taken from `aws_ecr_repository.app` here.
  source_repository_arn = (
    "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/${var.project_name}-${var.source_environment}"
  )
  is_prod = var.environment == "prod"

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
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
    ]
    resources = [aws_ecr_repository.app.arn]
  }

  # Promotion: the prod deploy role pulls the digest dev built from the dev
  # repository (`docker pull`, `describe-images`). Read is deliberate; write on
  # the dev repository stays denied so a prod run cannot change dev.
  dynamic "statement" {
    for_each = local.is_prod ? [1] : []

    content {
      sid    = "EcrPromotionRead"
      effect = "Allow"
      actions = [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:DescribeImages",
        "ecr:GetDownloadUrlForLayer",
      ]
      resources = [local.source_repository_arn]
    }
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
    # GetCommandInvocation is not evaluated against a scoped SSM ARN: "command/*",
    # the instance ARN and the account-level ARN all come back AccessDenied. It is
    # granted on "*" and pinned to the deployment region instead.
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region]
    }
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}

# Release role: only in the prod workspace. It adds a version tag to an image
# that is already running, so it can PutImage on the prod repository but cannot
# command a host, read a secret, or write to the dev registry.
data "aws_iam_policy_document" "github_release_trust" {
  count = local.is_prod ? 1 : 0

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

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.github_release_subjects
    }
  }
}

resource "aws_iam_role" "github_release" {
  count = local.is_prod ? 1 : 0

  name               = "${var.project_name}-${var.environment}-gha-release"
  description        = "GitHub Actions role that tags the deployed prod image with its release version."
  assume_role_policy = data.aws_iam_policy_document.github_release_trust[0].json
}

data "aws_iam_policy_document" "github_release" {
  count = local.is_prod ? 1 : 0

  statement {
    sid       = "EcrLogin"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrTagExistingImage"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:PutImage",
    ]
    resources = [aws_ecr_repository.app.arn]
  }
}

resource "aws_iam_role_policy" "github_release" {
  count = local.is_prod ? 1 : 0

  name   = "release"
  role   = aws_iam_role.github_release[0].id
  policy = data.aws_iam_policy_document.github_release[0].json
}
