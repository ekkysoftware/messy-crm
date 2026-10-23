resource "aws_cloudwatch_log_group" "app" {
  name              = "${local.app_name}-app"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "logs_write" {
  statement {
    sid = "WriteApplicationLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]
    # The Docker awslogs driver creates and writes streams inside the group,
    # so the stream suffix is required in addition to the group ARN itself.
    resources = ["${aws_cloudwatch_log_group.app.arn}:*"]
  }
}

resource "aws_iam_role_policy" "logs_write" {
  name   = "logs-write"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.logs_write.json
}
