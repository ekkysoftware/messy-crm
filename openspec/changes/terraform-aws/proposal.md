# Proposal

## Why

The app is deployable only to a developer machine today: `compose.yml` expects a local
`.env`, `infra/` is empty, and there is no repeatable way to put the same container image
on a public host. The project needs a deployed environment on AWS that can be created,
rebuilt, and destroyed from code — without a manual console session and without secrets in
the repository or in the image.

## What Changes

- **New Terraform root module** under `infra/terraform/` that provisions, in one `apply`:
  an ECR repository, an EC2 instance running the app with Docker Compose, a dedicated
  encrypted EBS data volume for PostgreSQL, an Elastic IP for a stable public address, two
  Secrets Manager secret entries, and a CloudWatch log group with retention.
- **Production Compose file** (`compose.prod.yml`) that runs the same two services as
  `compose.yml` but pulls `web` from ECR by tag instead of building, binds the Postgres data
  directory to the EBS mount point, publishes no database port, and reads configuration from
  a boot-time env file instead of a committed `.env`.
- **Boot-time configuration**: instance user data formats and mounts the data volume, reads
  `DJANGO_SECRET_KEY` and the database password from Secrets Manager through the instance
  IAM role, writes `/opt/messycrm/.env` with mode `0600`, and starts the stack. The image and
  the repository never contain either value.
- **Deployment recipe** (`infra/terraform/README.md` plus small `scripts/` helpers): one
  `apply` per workspace (`dev`, `prod`), then push the image to that environment's ECR
  repository and invoke the host-side `/opt/messycrm/deploy.sh` helper through SSM.
  Re-deployments do not touch infrastructure.
- **Two environments, one module**: the same configuration is applied once per Terraform
  workspace (`dev`, `prod`), each with its own host, registry, secrets, log group, and
  Elastic IP. Nothing is shared between them.
- **Envelope for local parity**: `DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS`
  derive from the Elastic IP so the existing settings read them unchanged. No application
  code, route, or payload shape changes.
- **Out of scope (deliberate)**: Route 53, ALB/NLB, TLS termination, CDN, RDS, autoscaling,
  multi-AZ, and the GitHub Actions pipeline. HTTP on the Elastic IP is the transport for
  this environment; `.github/workflow/` stays empty.

## Capabilities

### New Capabilities

- `aws-deployment`: how the application is hosted on AWS — image distribution, boot-time
  secret configuration, data persistence across instance replacement, stable public
  addressing, log retention, and reproducible create/destroy.

### Modified Capabilities

None. `crm-screen`, `crm-contact-commands`, and `crm-flash-messages` describe application
behaviour that this change does not alter; the deployment only changes where the process
runs and how it is configured.

## Impact

- `infra/terraform/` — new Terraform module (`versions`, `providers`, `variables`, `network`,
  `ecr`, `iam`, `secrets`, `storage`, `compute`, `observability`, `outputs`, user-data
  template, `terraform.tfvars.example`, module `README.md`).
- `compose.prod.yml` — new production Compose file at the repository root.
- `scripts/push-image.sh` — new helper for build/push/tag; `scripts/` gains no other change.
- `.gitignore` — ignore `infra/terraform/*.tfstate*`, `.terraform/`, `terraform.tfvars`,
  and plan files.
- `messycrm/settings.py` — read-only reuse: `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`,
  `DJANGO_CSRF_TRUSTED_ORIGINS`, `DATABASE_URL`, `INERTIA_VERSION`, `RUN_MIGRATIONS`
  already come from the environment; no code change expected.
- Requires an AWS account, an existing default VPC, Terraform ≥ 1.6, AWS CLI v2, Docker with
  `buildx`. No new Python or frontend dependencies.
