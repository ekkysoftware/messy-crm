# Proposal

## Why

The repository has no automation: `.github/` holds a single stray `.gitkeep` under a
misspelled `workflow/` directory, and every check and release is a manual step run from a
laptop. Two deployed environments (`dev`, `prod`) are planned, so promotion between them —
and the evidence that the same bytes reached both — has to live in the repository rather
than in an operator's shell history.

## What Changes

- **Fix the workflows directory**: add `.github/workflows/` and remove the stray
  `.github/workflow/.gitkeep` (singular) so GitHub actually discovers the pipelines.
- **`ci.yml`** — runs on every `pull_request` targeting `development` or `main`, and on
  every push to those branches. Parallel jobs: `backend` (`ruff check`, `ruff format
  --check`, `bandit` static analysis, `manage.py makemigrations --check --dry-run`,
  `manage.py check`, Django tests), `frontend` (`bun install --frozen-lockfile`, `vitest`,
  `tsc --noEmit`, `vite build`) and `workflows` (`actionlint`). All jobs are required gates;
  no AWS access, no deployment.
- **`deploy` job inside `ci.yml`** — `needs: [lint, test, build, workflows]` and
  `if: push`, so a pull request never deploys and a red gate never ships. `development`
  deploys `dev`; `main` deploys `prod` behind the `Production` environment's approval
  rules. The real steps (assume an environment-scoped AWS role via **OIDC**, `docker buildx`
  once, push to that environment's ECR repository, `aws ssm send-command` the host helper,
  smoke-test, roll back on failure) are blocked until `terraform-aws` is applied; until then
  the job writes its target environment, branch, commit, and intended image reference to
  `$GITHUB_STEP_SUMMARY` and deploys nothing.
- **Build once, promote by copy** — the `prod` job does not rebuild. It pulls the exact
  digest `dev` validated, re-tags it into the `prod` ECR repository, and asserts the digest
  is unchanged after the push.
- **`release.yml`** — runs only on `main`, only after a successful `CI` run (which
  includes the `deploy` job) — i.e. not on the `ci.yml` run itself.
  `python-semantic-release` derives the next version from Conventional Commits, bumps
  `pyproject.toml`, writes `CHANGELOG.md`, pushes the `vX.Y.Z` tag and opens a GitHub
  Release using a `RELEASE_TOKEN` PAT, then re-tags the already-deployed prod image with
  that version. The bump commit carries `[skip ci]` so the release cannot re-trigger CI or
  a deployment.
- **CI-to-infrastructure contract**: `infra/terraform/oidc.tf` adds the GitHub OIDC provider
  and one deploy role per environment (`Staging`, `Production`) plus a narrow `gha-release`
  role, trusted on the repository's environment/ref subjects; `scripts/publish-outputs.sh`
  copies the outputs **owned by `terraform-aws`** (`ECR_REPOSITORY`, `INSTANCE_ID`,
  `APP_URL`, `AWS_REGION`) into environment-scoped variables so the workflows never read
  state. Pipeline-facing Terraform outputs stay in `terraform-aws`'s `outputs.tf`; this
  change only adds `oidc.tf` to that module.
- **`docs/ci-cd.md`** — the pipeline runbook: triggers, required check names, the
  environment/variable table, rollback, and `RELEASE_TOKEN` rotation.
- **`pyproject.toml`** gains `python-semantic-release` (dev group) and its
  `[tool.semantic_release]` configuration, plus `bandit` (dev group) and a `[tool.bandit]`
  block for the static security analysis.
- **Out of scope**: Terraform applies from CI (infrastructure stays operator-run), remote
  Terraform state, a staging-specific database seed step, load/performance testing, and any
  change to application behaviour or routes.

## Capabilities

### New Capabilities

- `ci-cd-pipeline`: the automated path from a commit to a running revision — what gates a
  change, how an artifact reaches each environment, how the production release is cut, and
  how credentials are obtained.

### Modified Capabilities

None.

## Impact

- `.github/workflows/ci.yml` (gates + `deploy`), `.github/workflows/release.yml` — new;
  `.github/workflow/` — removed. There is no separate `deploy.yml`: `needs:` cannot cross
  workflow files, and the deploy gate has to be literal.
- `infra/terraform/oidc.tf` — added after the `terraform-aws` change lands; this pipeline
  cannot deploy until that module exists and has been applied once per workspace (`dev`,
  `prod`). `outputs.tf` is owned by `terraform-aws` and gains nothing here.
- `scripts/publish-outputs.sh` — new; `scripts/push-image.sh` and `scripts/deploy.sh` from
  `terraform-aws` stay as the manual fallback and call the same host-side deploy helper the
  workflows use.
- `pyproject.toml`, `CHANGELOG.md` — release tooling config; the changelog is generated.
- Repository settings are part of the deliverable: branch protection on `development` and
  `main`, the `Staging` and `Production` environments with required reviewers on
  `Production`, and the `RELEASE_TOKEN` secret.
- No application code, route, migration, or dependency of the running app changes.
