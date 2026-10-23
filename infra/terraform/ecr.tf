resource "aws_ecr_repository" "app" {
  name                 = local.app_name
  image_tag_mutability = "IMMUTABLE"

  # `terraform destroy` has to remove the repository together with the images
  # inside it, otherwise teardown of a used environment fails with
  # RepositoryNotEmptyException and leaves a billable resource behind.
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the last 10 tagged images"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["*"]
          countType      = "imageCountMoreThan"
          countNumber    = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}

locals {
  # <account>.dkr.ecr.<region>.amazonaws.com - the registry host the host logs in to.
  ecr_registry   = split("/", aws_ecr_repository.app.repository_url)[0]
  ecr_repository = aws_ecr_repository.app.name
}
