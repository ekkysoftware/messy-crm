# Design

## Context

See `proposal.md` — Why, and `specs/ci-cd-pipeline/spec.md` for the contract.

Observed state:

- `.github/` contains only `workflow/.gitkeep` — note the singular directory, which GitHub
  does not read. There is no `workflows/`, no CI, and `git tag` is empty.
- Branches: `main` only, so `development` is created as part of this work.
- Remote: `github.com:ekkysoftware/messy-crm`. GitHub is the only CI provider in scope.
- Backend checks that exist today: `ruff` (dev dependency), `manage.py check`,
  `manage.py test` (SQLite by default via `dj_database_url`, no service container needed).
- Frontend checks that exist today: `bun run test` (vitest), `bun run typecheck`,
  `bun run build`; `bun.lock` is committed.
- `pyproject.toml` has `version = "0.1.0"` and no `[tool.semantic_release]` section;
  `requires-python = ">=3.14"` with `.python-version` present, so CI pins the interpreter
  through `uv` rather than installing Python by hand.
- The `terraform-aws` change (not yet applied) provisions one environment per state, exposes
  `ecr_repository_url`, a host reachable over SSM, and an Elastic IP; its deploy path is
  "push image → SSM command → restart `messycrm.service`", with `IMAGE_TAG` in
  `/opt/messycrm/.env`.
- GitHub environments named `Staging` and `Production` already exist; the exact names must be
  read back from the API, because a job that names a non-existent environment gets an
  unprotected run instead of an error.

## Goals / Non-Goals

**Goals:**

- Three discoverable workflow files, each with one trigger shape and its own least-privilege
  permissions.
- One image build per commit; `prod` receives the identical digest, gated by an approval.
- Deploy failures leave the environment on the last known-good tag without operator
  intervention.
- No long-lived cloud credentials in the repository; an environment's credentials cannot act
  on the other environment.
- A release is a consequence of a successful production deploy, not a parallel process.

**Non-Goals:**

- Applying Terraform from CI, or moving state off the operator's machine.
- A fourth reusable workflow file — the two deploy paths are small enough to read inline, and
  the user asked for three files.
- Preview/staging-per-PR environments, matrices of versions, load tests, coverage gates.
- `zizmor`/Scorecard hardening beyond `actionlint`; Dependabot configuration.

## Decisions

### 1. Two files, split by event

`ci.yml` (gates on every pull request and push, plus the `deploy` job on pushes) and
`release.yml` (`workflow_run` completion of `CI` on `main`). Splitting keeps `permissions:`
minimal per file and per job: the four gate jobs never request `id-token: write`, so a
compromised dependency in a test job cannot mint a cloud credential.

`ci.yml` carries four jobs, named for the concern they gate:

| Job | Runs after | Toolchain | Gates |
|---|---|---|---|
| `workflows` | — | none | `actionlint` over `.github/workflows/` |
| `lint` | `workflows` | uv | `ruff check`, `ruff format --check`, `bandit -ll` |
| `test` | `workflows` | uv | migration drift, `manage.py check`, Django tests (`DJANGO_DEBUG=true`) |
| `build` | `workflows` | bun | frontend tests, `tsc --noEmit`, `vite build` |
| `deploy` | `lint`, `test`, `build` | none yet (stub) | target environment, branch, commit, image reference in the step summary |

The graph is `workflows → (lint ∥ test ∥ build) → deploy`. Validating the workflow files
first costs one 5-second round trip and stops everything else when the pipeline definition
itself is broken — the one failure mode where running the remaining jobs tells you nothing.
The three gates then fan out in parallel so wall-clock stays at one job's worth, and `deploy`
waits on all three (`workflows` is satisfied transitively).

Splitting lint from test matters for diagnosis, not speed: a red `lint` never means "read a
stack trace", and a red `test` never means "reformat". Job IDs are the required-status-check
names in branch protection, so they are frozen once protection is on.

**Alternative rejected:** a single `pipeline.yml` with `if:` guards per job — one
`permissions:` block would grant `id-token: write` to test jobs.

### 2. `ci.yml` holds the deploy jobs, gated by `needs`

```text
pull request        ──► workflows ─► lint ∥ test ∥ build                 (deploy skipped)
push to development  ──► workflows ─► lint ∥ test ∥ build ─► deploy
push to main        ──► workflows ─► lint ∥ test ∥ build ─► deploy ─► deploy-prod (approval)
```

Both jobs are written out in full rather than shared through a reusable workflow. The prod
job is not a copy of the dev job: it pulls the dev digest instead of building, so sharing
would leave two `if:` branches inside one shared file — less readable than ~25 duplicated
lines (role assumption, SSM send, smoke test).

### 3. Environment mapping is explicit and verified at the start of every deploy job

The region is **`ap-southeast-3`**, set once as `var.aws_region` in `terraform-aws`; no
workflow file hardcodes a region.

| Branch | GitHub environment | Terraform state | ECR repo variable | Host variable | URL variable |
|---|---|---|---|---|---|
| `development` | `Staging` | `dev` | `ECR_REPOSITORY_DEV` | `INSTANCE_ID_DEV` | `APP_URL_DEV` |
| `main` | `Production` | `prod` | `ECR_REPOSITORY_PROD` | `INSTANCE_ID_PROD` | `APP_URL_PROD` |

Verified 2026-10-23 against `gh api repos/ekkysoftware/messy-crm/environments` — exactly two
environments exist, with no lowercase variant, so the workflow files and
`scripts/publish-outputs.sh` must use these exact strings:

| Environment | Protection rules | Reviewers | `prevent_self_review` |
|---|---|---|---|
| `Production` | 1 × `required_reviewers` | `ekkysoftware` | `false` |
| `Staging` | none | — | — |

`prevent_self_review: false` is load-bearing for this repository: the only required reviewer
is the account that also opens the pull request, so enabling self-review prevention would make
prod deploys unapprovable. Keep it off while this is a solo repository, and only assert
`protection_rules` is non-empty in the deploy guard — do not assert the rule *type*.

Terraform's own `environment` values stay `dev`/`prod` (per the `terraform-aws` variable), and
each environment is a separate **Terraform workspace** with its own state, host, and registry.
The GitHub environment names keep the capitalisation that already exists in the repository.
Both roles are read from the environment-scoped variable `AWS_DEPLOY_ROLE_ARN`, so the same
expression works for either job and approval gating comes from the environment itself.

`AWS_REGION` is published alongside them (from `terraform output aws_region`, i.e.
`ap-southeast-3`): `configure-aws-credentials`, `aws ecr get-login-password`, `aws ssm
send-command` and the host-side deploy helper all need it, and an unset region would silently
default the CLI to a different region than the resources live in.

First step of each job is a guard:

```bash
gh api "repos/${GITHUB_REPOSITORY}/environments/${ENV_NAME}" >/dev/null || {
  echo "::error::GitHub environment '${ENV_NAME}' does not exist; refusing to deploy without its protection rules"; exit 1; }
```

For `Production` the guard also asserts a non-empty `protection_rules` array, because an
environment that exists but has no reviewers is exactly the silent failure mode the spec
calls out.

### 4. OIDC for credentials; one deploy role per environment, one narrow release role

`infra/terraform/oidc.tf` adds the GitHub OIDC provider and, per Terraform workspace, one
role: `gha-deploy-${var.environment}`:

- `gha-deploy-dev` — trusted on `repo:ekkysoftware/messy-crm:environment:Staging`; can
  push/pull on the dev repository and `ssm:SendCommand`/`GetCommandInvocation` on the dev
  instance only.
- `gha-deploy-prod` — trusted on `...:environment:Production`; **write** on the prod
  repository, **read-only** (`BatchGetImage`, `GetDownloadUrlForLayer`,
  `BatchCheckLayerAvailability`) on the dev repository because promotion pulls the validated
  digest from it, and SSM scoped to the prod instance only. Created only in the `prod`
  workspace, together with `gha-release` — trusted on
  `repo:ekkysoftware/messy-crm:ref:refs/heads/main` with **no** environment, allowed only
  `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`,
  `ecr:BatchCheckLayerAvailability`, `ecr:PutImage` on the prod repository.

The OIDC provider itself is an **account-level singleton**: creating it in both workspaces
fails with `EntityAlreadyExists`. It is created once
(`var.create_github_oidc_provider = true` in the first workspace applied, `dev`) and read
through `data.aws_iam_openid_connect_provider` in the other, which keeps both applies
idempotent and order-independent after the first one.

`gha-release` exists so the version label does not need a second approval prompt: a merge that
already passed the `Production` gate can add a tag to an **existing** digest, which cannot
change what is running. It cannot read secrets, command a host, or push to the dev registry.

The rule the spec enforces is **no cross-environment writes and no cross-environment host
control**; reading an image for promotion is explicitly allowed, which is why the prod role
has read on both repositories but write on one, and why the dev role cannot pull from prod
(nothing needs it).

`SSM` access uses `AWS-RunShellScript` against a document with a fixed script, not
`ssm:StartSession`. Two verified asymmetries decide the policy:

- `ssm:SendCommand` must list **both** the document ARN
  (`arn:aws:ssm:<region>::document/AWS-RunShellScript`) and the environment's instance ARN —
  scoping to the instance alone denies the call.
- `ssm:GetCommandInvocation` **cannot** be resource-scoped: `command/*`, the instance ARN and
  the account-level SSM ARN are all denied, and the simulator reports `implicitDeny` even for
  `Resource: "*"`. It is therefore granted on `"*"` with an `aws:RequestedRegion` condition
  pinned to the deployment region.

The subject claim is also not what the classic documentation says. GitHub now issues
ID-qualified ("immutable") subjects — `repo:owner@343379447/repo@1430577435:environment:Staging`
— so the trust policy matches `StringLike` against **both** the classic and the ID-qualified
form, with owner and repository names exact and only the numeric ids wildcarded.

All jobs go through `configure-aws-credentials` with `mask-aws-account-id: true`; no static
keys exist anywhere.

### 5. Build once: dev builds and pushes, prod pulls the digest and re-tags

`build-and-deploy-dev` builds `linux/amd64` from the repo `Dockerfile` with buildx, pushes
`<dev-repo>:sha-<short>`, and writes the digest to the job summary. `promote-to-prod` asserts
the digest exists in the dev repository for that commit, then:

```bash
docker pull "${DEV_REPO}@${DIGEST}"
docker tag  "${DEV_REPO}@${DIGEST}" "${PROD_REPO}:sha-${SHORT}"
docker push "${PROD_REPO}:sha-${SHORT}"
docker buildx imagetools inspect "${PROD_REPO}:sha-${SHORT}" --format '{{.Manifest.Digest}}'
```

The last line is the assertion: the prod manifest digest must equal the dev digest. Because
the image is single-platform, `docker tag`/`push` copies the manifest verbatim, so a mismatch
means something rebuilt or re-resolved the image and the job fails.

ECR repositories are `IMMUTABLE` (from `terraform-aws`), so `sha-<short>` is pushed once. A
re-run of the same commit therefore **reuses** the existing image and reports its digest
instead of failing on a rejected overwrite: the tag is commit-derived, so the image it points
at can only have come from that commit. Overwriting is still impossible, which is the point of
`IMMUTABLE`.

**Alternative rejected:** building separately for prod — it re-introduces "works in staging".
**Alternative rejected:** a shared repository for both environments — it would let the dev
role write the tag prod pulls, so a compromised dev pipeline could ship to prod.

### 6. Deployment is an SSM command that invokes one host-side helper

The host runs `messycrm.service` → `docker compose up -d` with `IMAGE_TAG` from
`/opt/messycrm/.env`. Rather than embedding `sed` and `systemctl` in the workflow, the
`terraform-aws` user data installs a single `/opt/messycrm/deploy.sh` that takes a tag and
does all of it:

```bash
# /opt/messycrm/deploy.sh <tag>
caught=$(grep -oP '^IMAGE_TAG=\K.*' /opt/messycrm/.env)
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" /opt/messycrm/.env
systemctl restart messycrm
# health-check the container, print the previous tag on stdout for rollback
```

There are three reasons this lives on the host instead of in the workflow:

1. **ECR tokens expire after 12 hours.** The boot script can log in once, but the pipeline
   usually runs hours or days later, and `docker compose pull` would then fail with `403`.
   The helper logs in on every invocation using the instance role.
2. **One implementation.** `scripts/deploy.sh` (the manual fallback from `terraform-aws`) is
   a thin SSM wrapper around the same helper, so the pipeline and a human running the script
   cannot drift.
3. **Rollback is the same call.** The workflow reads the current tag with
   `grep -oP '^IMAGE_TAG=\K.*'` before deploying, and rolls back by invoking the helper again
   with that value — no second code path to maintain.

The workflow step is then `aws ssm send-command` with
`commands: sudo -n /opt/messycrm/deploy.sh sha-<short>`, polled through
`GetCommandInvocation` and failed on `Failed`/`TimedOut`/`Cancelled`. `send-command` (not
`start-session`) keeps the step non-interactive and identical for dev, prod, and rollback.

`ExecStartPre=-docker compose pull` in the unit (from `terraform-aws`) is what fetches the new
tag; the job does not `docker pull` on the host.

### 7. Smoke test reads the app, not the container

After the command succeeds: `curl -fsS --retry 12 --retry-delay 5 --retry-connrefused
"${APP_URL}/"` and assert the body contains the Inertia root element (`<div id="app"`). This
single request proves gunicorn is up, WhiteNoise found the hashed asset manifest, and the
settings accepted the host — the three failures that actually happen.

### 8. Rollback reads the previous tag from the host before overwriting it

Both jobs capture the current tag first (`grep -oP '^IMAGE_TAG=\K.*' /opt/messycrm/.env`)
and keep it in the job env. If the smoke test fails, the job issues the same SSM command with
that tag, re-checks the URL, and then fails the run — so the failure is red, and prod is back
on the last good revision rather than serving a broken one. Rollback needs no extra
infrastructure: the previous image is already in the prod repository.

### 9. `release.yml` runs from `workflow_run` on CI

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
```

`workflow_run` fires on the default branch's copy of the workflow with the base repository's
secrets, and its `if:` filters `conclusion == 'success'`. Since `deploy` is a job inside
`ci.yml`, a successful CI run on `main` means the deploy job succeeded too — the ordering the
spec wants (**deploy first, release second**) with `release.yml` still a separate file, and
`release.yml` itself never holds deploy credentials.

The cost is that `workflow_run` cannot express "the prod job specifically succeeded" beyond
the whole run's conclusion; `deploy` is the only job after the gates, so run success is a
sufficient signal.

**Alternative rejected:** a final `release` job inside `ci.yml` — fewer files, but it
puts `contents: write` and a PAT into the same file that holds deploy credentials.
**Alternative rejected:** `workflow_dispatch` — manual releases defeat the point.

### 10. `python-semantic-release` configuration lives in `pyproject.toml`

```toml
[tool.semantic_release]
version_toml = ["pyproject.toml:project.version"]
branch = "main"
commit_parser = "conventional"
commit_message = "chore(release): {version} [skip ci]"
commit_author = "semantic-release <semantic-release@users.noreply.github.com>"

[tool.semantic_release.branches.main]
match = "(main)"
```

`[skip ci]` in the bump commit is what stops the release from re-triggering `ci.yml` and
`ci.yml` (GitHub honours it for `push` events). The alternative — `paths-ignore` on
`pyproject.toml`/`CHANGELOG.md` — would skip a deploy for a legitimate PR touching
`pyproject.toml`, so it is rejected.

`RELEASE_TOKEN` is a fine-grained PAT with `contents: write` on this repository only, passed
to `actions/checkout` as `token:` and to PSR as `github_token`, because the default
`GITHUB_TOKEN` cannot push to a protected `main` (the tag and bump commit would be rejected).
`persist-credentials: false` keeps it out of `.git/config` afterward.

### 11. Release re-tags without rebuilding

`release.yml` reads the tag PSR just created (`git describe --tags --abbrev=0`), assumes
`gha-release`, then reads the digest of `<prod-repo>:sha-<short>` and pushes the same digest
as `:<version>`:

```bash
DIGEST=$(aws ecr describe-images --repository-name "$PROD_REPO" \
  --image-ids imageTag="sha-${SHORT}" --query 'imageDetails[0].imageDigest' --output text)
MANIFEST=$(aws ecr batch-get-image --repository-name "$PROD_REPO" \
  --image-ids imageDigest="$DIGEST" --query 'images[0].imageManifest' --output text)
aws ecr put-image --repository-name "$PROD_REPO" \
  --image-tag "$VERSION" --image-manifest "$MANIFEST"
```

`put-image` with an unchanged manifest is a metadata-only write: same digest, new tag, no
rebuild, no push of layers.

### 12. `bandit` runs in the `lint` job, at medium severity and above

`uv add --dev bandit` plus `[tool.bandit]` in `pyproject.toml` (excluding generated code —
`crm/migrations`, `frontend`, `.venv` — with **no** global `skips`), invoked as
`uv run bandit -c pyproject.toml -r crm messycrm -x crm/migrations -ll`.

- **A step, not a job.** Branch protection requires `lint`, `test`, `build`, `workflows`;
  a fifth check name for a 1-second scan is churn, and the scan reads the same source the
  lint job already checks out.
- **`-ll` (medium+) rather than everything.** Low-severity findings here are `assert` usage in
  tests and hardcoded fixtures — noise that trains people to ignore the check. Medium+ is
  where `shell=True`, `pickle`, `eval`, weak crypto, and SQL string building live.
- **Gating on exit code, with a measured zero baseline.** The current tree reports 0 findings
  at every severity across 506 LOC (`crm` + `messycrm`), so the gate starts strict instead of
  starting from a waivered audit report that never gets paid down.
- **Waivers are per-line `# nosec B<id>` with a reason**, never `skips` in config: the reason
  is visible in the diff and in review, which a config list never is.

`bandit` is the right depth here: it is a single offline AST pass with no rules to maintain.
Semgrep needs rule packs and network access; `pip-audit` answers a different question
(vulnerable dependencies, not vulnerable code) and belongs in a separate follow-up.

**Verification without `act`.** CI is validated by running the identical commands locally in
the same order and then by the real run on `development` — no local Actions emulator. `act`
re-implements caching, service containers, and runner images approximately, so a green `act`
run proves little beyond what running the commands proves, while a red one frequently reports
an emulator difference rather than a real defect. A workflow change is only *done* when the
real run goes green, which is also where the required check names come from.

### 13. Concurrency and cancellation

`cancel-in-progress: true` for `ci.yml` (superseded PR runs are worthless) and
`cancel-in-progress: false` for both deploy jobs, keyed per environment
(`deploy-dev`, `deploy-prod`). A cancelled deploy would otherwise leave a half-applied tag.

### 15. The `test` job runs Django tests with `DJANGO_DEBUG=true`

A clean checkout has no `frontend/dist` (gitignored), and `settings.py` defaults `DEBUG` to
false, so django-vite demands a Vite manifest that only exists after `bun run build` — every
page-rendering test then fails with `DjangoViteAssetNotFoundError`. `crm/tests/test_template.py`
additionally asserts the **dev-mode** entry (`src/app.tsx`), which only appears when
`DEBUG=true`. The job therefore sets `DJANGO_DEBUG: "true"` and skips building the bundle.

The production asset path is not left untested: the image build runs `collectstatic`, which
fails without the manifest, and the deploy smoke test fetches the dashboard and a hashed
asset. Making the suite mode-agnostic (build the bundle, assert both modes) is a follow-up
change, not a silent gap — recorded under risks.

### 16. `workflow_dispatch` is the manual escape hatch for both jobs

`ci.yml` also declares `workflow_dispatch` with inputs `environment` (`Staging` |
`Production`) and `image_tag` (a previously published tag). The job `if:` conditions accept
the dispatch case, so re-running an older tag and promoting out of band use the same steps,
the same OIDC roles, and the same smoke test as the push path. `environment` selects the
literal environment name, so an approved dispatch to `Production` still goes through the
environment's reviewers.

## Risks / Trade-offs

- **`gha-release` has no environment gate.** → Its permissions are metadata-only on one
  repository (`PutImage` of an existing manifest) and its trust is pinned to
  `refs/heads/main`, which is protected and requires green checks. The alternative (a second
  approval prompt per release) was judged worse for a solo workflow.
- **Re-tagging depends on `IMMUTABLE` allowing a new tag, not a new digest.** → If a future
  change makes repositories `MUTABLE`, the "same digest" assertion in `promote-to-prod` still
  catches overwrites; the version tag push would silently succeed, so the assertion matters.
- **Two ECR repositories mean two copies of every layer.** → Storage cost is trivial at this
  size; the isolation is worth it.
- **`workflow_run` fires with the default branch's code**, so a change to `release.yml` only
  takes effect after merging. → Accepted; it also means a PR cannot tamper with the release
  job's privileges.
- **Environment names are case-sensitive in practice** (`Staging` vs `staging`). → The guard
  step fails fast, and `scripts/publish-outputs.sh` writes the variables into the same
  environment names, so a mismatch is caught on the first run rather than after a silent
  unprotected deploy.
- **`sed -i` on the host's `.env` is not idempotent-safe if the file is missing.** → The
  deploy command checks for the file first and fails with a clear message; the unit is
  managed by `terraform-aws`, so a missing file means the host was never bootstrapped.
- **Rollback is bounded by registry retention.** `terraform-aws` expires all but the 10 most
  recent tagged images, so a manual rollback can only target a tag that still exists; the
  pre-flight "no validated artifact" check turns that into a clear error instead of a pull
  failure mid-deploy.
- **The suite only runs in dev mode in CI.** `DJANGO_DEBUG=true` means the `DEBUG=false`
  template path (`{% vite_asset %}` against the manifest, WhiteNoise) is covered by the image
  build and the deploy smoke test rather than by a unit test. → Accepted for now; a hermetic
  two-mode test is a follow-up change.
- **Django tests run against SQLite**, unlike production Postgres. → Out of scope here; the
  `terraform-aws`/CI research calls for a Postgres service job later. Recorded, not hidden.
- **Secrets in the workflow files**: none. `RELEASE_TOKEN` is the only secret, and it is a
  PAT scoped to contents.
- **No `zizmor` baseline.** → `actionlint` catches syntax/expression errors, not
  over-broad permissions or `pull_request_target` misuse. A follow-up hardening pass is
  listed in tasks as an optional item, not a requirement.

## Migration Plan

1. Create `development` from `main`; push it.
2. Apply `terraform-aws` once per workspace (`terraform workspace new dev` +
   `apply -var environment=dev`, then `workspace new prod` + `apply -var environment=prod`) so
   both ECR repositories, hosts, and URLs exist; then `terraform apply` the OIDC layer added
   here in each workspace.
3. `scripts/publish-outputs.sh` writes `ECR_REPOSITORY_*`, `INSTANCE_ID_*`, `APP_URL_*`,
   `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN` into the `Staging`/`Production` environments.
4. Add `RELEASE_TOKEN`; confirm `Production` has required reviewers.
5. Protect `development` and `main`: require a PR, require `backend`, `frontend`,
   `workflows`.
6. Merge the pipeline PR into `development` → first dev deploy; then PR `development` → `main`
   → approval → first prod deploy → first release.

**Deploy gate lives in `ci.yml`.** `needs:` cannot cross workflow files, and the literal
guarantee wanted is "deploy only after `lint`, `test`, `build` and `workflows` pass", so
`deploy` is the fifth job in `ci.yml` with `needs: [lint, test, build, workflows]` and
`if: github.event_name == 'push'` (pull requests never deploy). `deploy.yml` is therefore not
a separate file; its remaining content is the environment-specific half of this job.

**Rollback:** re-run the `CI` workflow via `workflow_dispatch` with an earlier commit SHA that has
a published image (`image_tag` input), or revert the pipeline PR. Neither touches
infrastructure.
