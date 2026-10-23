# Design

## Context

See `proposal.md` — Why, and `specs/aws-deployment/spec.md` for the behaviour contract.

Current state that shapes the design:

- `compose.yml` runs two containers: `db` (`postgres:16-alpine`) and `web` (built from the repo
  `Dockerfile`, gunicorn/WSGI on port 8000, WhiteNoise serving `/static/`, migrations on boot
  via `docker/entrypoint.sh`).
- `messycrm/settings.py` already reads every deployment knob from the environment:
  `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`,
  `DATABASE_URL`, `INERTIA_VERSION`, and `RUN_MIGRATIONS` (entrypoint). No settings change
  should be needed.
- The `Dockerfile` builds the frontend (`bun`) and runs `collectstatic` at image build time, so
  a pulled image is self-contained: no Node/bun, no source, no DB at runtime.
- `infra/` is empty; `.github/workflow/` is empty. There is no CI and none is in scope.
- Local toolchain available: Terraform 1.16, AWS CLI v2, Docker buildx.
- Deployment target is x86_64 because the image is built on the operator's x86_64 machine;
  cross-arch builds would add a `buildx --platform` dependency for no benefit here.

## Goals / Non-Goals

**Goals:**

- One `terraform apply` yields a working host; one `scripts/push-image.sh` + one redeploy step
  yields a new application version.
- `terraform plan` after an unchanged apply is empty (idempotent, no random names that
  re-roll on re-apply).
- Secrets never appear in git, in the image, in `terraform.tfstate`, or in plan output.
- Data survives instance replacement; destroying the stack removes everything.
- Diagnosing a failure needs CloudWatch only — no shell on the host.

**Non-Goals:**

- TLS, custom domains, Route 53, ALB/NLB, CDN, WAF.
- Multi-AZ, autoscaling, rolling deploys, zero-downtime releases.
- RDS, read replicas, managed backups, PITR.
- A CI pipeline or GitHub OIDC. Publishing the image stays a local, documented step.
- Remote Terraform state / state locking.

## Decisions

### 1. Single EC2 host with Docker Compose, not ECS/App Runner

`compose.yml` is already the deployment manifest, the app is a two-container stack (web +
Postgres), and the scope is one environment. ECS/Fargate would add a cluster, task
definitions, an ALB and target groups to reach the same result; App Runner cannot host the
database container at all, so it would force RDS and a VPC connector. A single host keeps one
mental model and the lowest cost (~$20/month).

**Alternative rejected:** ECS Fargate + RDS + ALB — production-shaped, but four extra services
and no requirement in scope needs them.

### 2. PostgreSQL stays a container; its data lives on a separate EBS volume

The database is `postgres:16-alpine` (as today). A dedicated `aws_ebs_volume` (gp3, encrypted,
`/dev/sdf`) is formatted `ext4` with label `messycrm-data` on first boot and mounted at
`/srv/messycrm/postgres`; `compose.prod.yml` bind-mounts that directory to
`/var/lib/postgresql/data`. The volume has `lifecycle { prevent_destroy = false }` and is not
attached with `delete_on_termination`, so instance replacement (AMI update, instance type
change, user-data change) keeps the data.

- Mount by **label**, not `/dev/xvdf`: Nitro instances rename EBS devices to `nvme1n1`, and
  `LABEL=` in `/etc/fstab` with `nofail` survives both renames and a missing volume.
- Format is guarded by `blkid -L messycrm-data || mkfs.ext4 -L messycrm-data …`, so a reboot
  never re-formats.
- The database port is published to `127.0.0.1` only (or not at all — `web` reaches `db` over
  the Compose network); the security group opens only the app port.

**Alternative rejected:** `RDS` — correct for production, adds a managed service, subnet group
and security-group pair, and ~$15/month for no in-scope benefit. **Alternative rejected:**
Docker named volume on the root disk — lost on instance replacement, which the spec forbids.

### 3. Elastic IP, no load balancer

The EIP is allocated and associated with the instance; it survives stop/start, and the address
is known before the instance boots, so `DJANGO_ALLOWED_HOSTS` and
`DJANGO_CSRF_TRUSTED_ORIGINS` (both `http://<eip>`) can be rendered into the boot env file by
Terraform. Nothing in the app needs to know its own address at runtime.

Because there is no proxy in front, `compose.prod.yml` publishes `80:8000`. HTTP is the
transport for this environment; see Risks.

**Alternative rejected:** ALB + ACM + Route 53 — the "real" front door, but three more
resources and DNS ownership the exercise does not have.

### 4. Terraform renders the whole host configuration; the host is disposable

`user_data` is a `templatefile` that receives the rendered `compose.prod.yml` (`file()`), the
log group name, the secret ARNs' names, and the EIP-derived host. It performs, in order:
install Docker + Compose v2 plugin + `jq`; format/mount the data volume; create
`/opt/messycrm/.env` (mode `0600`) by reading the two secrets with the instance role; write
`/opt/messycrm/compose.yml`; install a `messycrm.service` systemd unit
(`docker compose pull` best-effort, then `up -d`, `Restart=always`).

Instance replacement is therefore the deploy mechanism for host-level changes, and it is safe
because data is on the EBS volume and the address is an EIP. `Dockerfile`/`compose.prod.yml`
changes flip `user_data_replace_on_change`, which is intentional: those are the files that
define the host. Day-to-day application releases do **not** touch Terraform (see Decision 6).

**Alternative rejected:** S3 bucket for the Compose file + instance-fetched config — one more
resource and a per-object IAM policy for a file that is already in git.

**Alternative rejected:** cloning the repo on the host — needs a credential on the instance and
puts build tooling on a production host.

### 5. Two Secret Manager containers, populated out-of-band

Terraform creates `messycrm/<env>/django` and `messycrm/<env>/db` as `aws_secretsmanager_secret`
resources **without** a managed `aws_secretsmanager_secret_version`. Values are written by
`scripts/set-secrets.sh` (generates `openssl rand -base64 48` for the Django key and
`-hex 24` for the Postgres password, then `aws secretsmanager put-secret-value`).

This is deliberate: a Terraform-managed secret version would place the plaintext in
`terraform.tfstate`, violating the spec's "not readable from state" requirement. The cost is
that Terraform cannot create a fully working host in one command; the boot script fails loudly
if a secret is absent, and the README orders `apply → set-secrets → push-image → restart`.

**Alternative rejected:** `random_password` + `aws_secretsmanager_secret_version` — convenient,
but the value lands in state (and in `terraform output` if exported).

### 6. Image publishing is a script; redeploy is one host-side helper

`scripts/push-image.sh` builds the existing `Dockerfile`, tags with the short git SHA (or an
explicit tag), logs in to ECR with `aws ecr get-login-password`, and pushes.

The host owns a single `/opt/messycrm/deploy.sh <tag>` (installed by user data), because a
redeploy has to do more than one thing and must do it identically no matter who triggers it:

```bash
grep -oP '^IMAGE_TAG=\K.*' /opt/messycrm/.env        # emit previous tag, for rollback
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" /opt/messycrm/.env
systemctl restart messycrm
```

The script fails with an explicit "host not bootstrapped" message when
`/opt/messycrm/.env` is absent, which means user data never completed.

The per-invocation `docker login` matters: ECR authorization tokens expire after 12 hours, so
a login performed once at boot would make the first redeploy a day later fail with `403` and
the application would keep running the old image while the deploy looked successful.

`scripts/deploy.sh <tag>` is a thin wrapper: it `aws ssm send-command`s
`sudo -n /opt/messycrm/deploy.sh <tag>` to the environment's instance and prints the command
id and status. GitHub Actions invokes exactly the same host helper, so the pipeline and the
manual fallback cannot drift. Rollback is the same call with the previous tag; ECR is
`IMMUTABLE`, so a tag can never be silently overwritten.

**Alternative rejected:** SSH with a key pair — requires an inbound 22 rule and a key on the
operator machine; SSM needs no ingress rule and gives an audit trail for free.
**Alternative rejected:** embedding the `sed`/`systemctl`/login sequence in each workflow run
— two copies of the release logic, and the ECR login would be missing from one of them.

### 7. Logs go to CloudWatch through the Docker `awslogs` driver

`compose.prod.yml` sets `logging.driver: awslogs` with `awslogs-group` (created by Terraform
with 14-day retention), `awslogs-region`, and `awslogs-stream-prefix`. The Docker daemon
authenticates with the instance role, so no CloudWatch agent, no log files on disk, and
`AWS_REGION` needs no extra config. The IAM policy scopes `logs:PutLogEvents` /
`logs:CreateLogStream` to that log group ARN.

**Alternative rejected:** the CloudWatch agent reading `/var/lib/docker/containers` — a
package to install, a config to render, and duplicate storage on a 30 GiB root volume.

### 8. Default VPC, one security group, one instance

`data.aws_vpc.default` + `data.aws_subnets` avoid 6–8 VPC resources for a single public host.
The single security group allows inbound `80` from `var.app_ingress_cidr` (default
`0.0.0.0/0`) and all egress. No SSH rule exists at all.

### 9. Local Terraform state, one workspace per environment

State is local and git-ignored: `.terraform/`, `*.tfstate*`, `terraform.tfstate.d/` (the
workspace states), `*.tfplan`, and `terraform.tfvars`. Two environments are two **workspaces**
— `terraform workspace new dev` and `terraform workspace new prod` — each with its own host,
registry, secrets, log group, and EIP, all derived from the same configuration. No S3 backend
and no DynamoDB lock table — single operator, exercise scope. This is recorded as a
trade-off, not an oversight.

**Alternative rejected:** two copies of the module or two directories
(`infra/terraform-dev`, `infra/terraform-prod`) — duplicated code that drifts, and no
isolation benefit over workspaces at this scale.
**Alternative rejected:** `-state=dev.tfstate` flags — easy to forget, and paths end up in
shell history instead of a documented workflow.

## Risks / Trade-offs

- **No TLS.** Session and CSRF cookies travel over plain HTTP, and any browser on the network
  path can read them. → Acceptable only for this exercise; the security group's
  `app_ingress_cidr` can be narrowed to the operator's IP to shrink the exposure, and adding
  Caddy with a `nip.io` name is a self-contained follow-up.
- **Single host = single point of failure.** Instance stop, OOM, or a full disk takes the site
  down. → `restart: unless-stopped` plus the systemd unit's `Restart=always` covers process
  crashes; capacity is not a concern at this size.
- **`terraform destroy` deletes the database volume.** → Documented in the README with a
  manual-snapshot step before destroy; the spec deliberately requires destroy to remove
  billable resources.
- **First apply creates a host with no image.** `docker compose pull` fails and
  `messycrm.service` restarts until the first push. → `push-image.sh` is part of the documented
  bootstrap order and ends with the restart command, so the window is a single documented step.
- **`user_data_replace_on_change = true` replaces the instance** when `compose.prod.yml`,
  the boot script, or the AMI changes, causing a ~1 minute outage and a fresh `migrate` run. →
  Accepted: migrations are idempotent, data is on the separate volume, the EIP re-associates,
  and this is the desired behaviour for host-level changes.
- **Compose v2 plugin must be fetched from Docker's GitHub releases** because AL2023's `docker`
  package does not ship it. → Version is pinned in a Terraform variable and the download is
  checksum-verified by the installer script's `set -euo pipefail`; the URL pattern is stable.
- **Secrets are read only at boot.** Rotating a secret requires a host restart (documented).
- **Local state on a laptop can be lost**, orphaning billable resources. → README documents
  `terraform import` for the EBS volume in that case; a remote backend is the upgrade path.
- **Postgres in a container has no autovacuum tuning and no backup automation.** → Out of
  scope; a `pg_dump` cron is the minimal follow-up if the environment outlives the exercise.

## Migration Plan

1. `terraform init && terraform apply` with `project_name` set → ECR repo, secret containers,
   log group, EBS volume, instance, EIP. The web container is in a pull-failure restart loop.
2. `scripts/set-secrets.sh` → both secret values exist.
3. `scripts/push-image.sh` → first image tag lands in ECR.
4. `scripts/deploy.sh <tag>` → writes `IMAGE_TAG`, restarts `messycrm.service`; the entrypoint
   runs `migrate`; `/` returns the dashboard.
5. `seed_crm` through SSM only if demo data is wanted (`docker compose exec web python
   manage.py seed_crm`).

**Rollback:** `scripts/deploy.sh <previous-tag>` — no infrastructure change. Reverting a
host-level change is `git revert` + `terraform apply`, which replaces the instance and
re-attaches the same data volume.

**Teardown:** `terraform destroy` (after an optional snapshot of the data volume).
