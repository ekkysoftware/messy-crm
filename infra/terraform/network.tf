# Default VPC, one security group, one Elastic IP. No SSH ingress exists at all:
# administration goes through SSM Session Manager / Run Command.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_subnet" "selected" {
  id = sort(data.aws_subnets.default.ids)[0]
}

resource "aws_security_group" "app" {
  name        = "${local.app_name}-app"
  description = "Application host: inbound HTTP from var.app_ingress_cidr, all egress."
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "${local.app_name}-app"
  }
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.app.id
  description       = "Application HTTP"
  cidr_ipv4         = var.app_ingress_cidr
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.app.id
  description       = "All outbound traffic"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_eip" "app" {
  domain = "vpc"

  tags = {
    Name = "${local.app_name}-app"
  }
}

resource "aws_eip_association" "app" {
  allocation_id = aws_eip.app.id
  instance_id   = aws_instance.app.id
}
