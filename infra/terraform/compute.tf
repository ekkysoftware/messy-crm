data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

locals {
  # Non-secret configuration rendered into /opt/messycrm/host.env on the host.
  # configure.sh turns it into the .env the Compose stack reads, adding the two
  # secrets it resolves at boot.
  host_env = join("\n", [
    "PROJECT_NAME=${var.project_name}",
    "ENVIRONMENT=${var.environment}",
    "AWS_REGION=${var.aws_region}",
    "ECR_REGISTRY=${local.ecr_registry}",
    "ECR_REPOSITORY=${local.ecr_repository}",
    "LOG_GROUP=${aws_cloudwatch_log_group.app.name}",
    "IMAGE_TAG=${var.image_tag}",
    "DJANGO_SECRET_NAME=${aws_secretsmanager_secret.django.name}",
    "DB_SECRET_NAME=${aws_secretsmanager_secret.db.name}",
    "DJANGO_DEBUG=false",
    "DJANGO_ALLOWED_HOSTS=${aws_eip.app.public_ip}",
    "DJANGO_CSRF_TRUSTED_ORIGINS=http://${aws_eip.app.public_ip}",
    "POSTGRES_USER=${var.project_name}",
    "POSTGRES_DB=${var.project_name}",
  ])
}

resource "aws_instance" "app" {
  # The provider marks the SSM parameter value sensitive; an AMI id is public and
  # keeping it visible makes `terraform plan` reviewable.
  ami                    = nonsensitive(data.aws_ssm_parameter.al2023_ami.value)
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.selected.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name

  # Host-level changes (boot script, compose.prod.yml) replace the instance;
  # data is on the EBS volume and the address is the Elastic IP, so that is safe.
  user_data                   = local.user_data
  user_data_replace_on_change = true

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${local.app_name}-app"
  }

  # The awslogs driver must find its log group before the stack starts.
  depends_on = [aws_cloudwatch_log_group.app]
}

locals {
  user_data = templatefile("${path.module}/templates/user_data.sh.tftpl", {
    project_name     = var.project_name
    environment      = var.environment
    public_ip        = aws_eip.app.public_ip
    compose_version  = var.compose_version
    host_env         = local.host_env
    compose_file     = file("${path.module}/../../compose.prod.yml")
    configure_script = file("${path.module}/templates/configure.sh")
    deploy_script    = file("${path.module}/templates/deploy.sh")
    systemd_unit     = file("${path.module}/templates/messycrm.service")
  })
}
