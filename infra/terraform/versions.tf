locals {
  # Resource name prefix shared by every resource: <project>-<environment>.
  app_name = "${var.project_name}-${var.environment}"
}
