# Changelog

<!-- version list -->

## v0.3.0 (2026-10-26)

### Bug Fixes

- **crm**: Reject invalid contact values and statuses when editing
  ([`b8d2f51`](https://github.com/ekkysoftware/messy-crm/commit/b8d2f517b9da38091a0d4f08584ca945d490fc5b))

- **frontend**: Handle failed contact writes, trap dialog focus, and correct Unicode initials and
  focus outlines
  ([`4f27727`](https://github.com/ekkysoftware/messy-crm/commit/4f277277cb5eebaabdae9ec3bf32f3a9bc284945))

- **frontend**: Move contact search above the contact table
  ([`438981f`](https://github.com/ekkysoftware/messy-crm/commit/438981f98164c8985b6e93b637f32d2e81556399))

### Features

- **crm**: Add contact edit form
  ([`9961a2a`](https://github.com/ekkysoftware/messy-crm/commit/9961a2a670833226f0ca31803871f072bf33eb57))

- **frontend**: Rebuild the CRM screen from the pen design
  ([`cbcc9f7`](https://github.com/ekkysoftware/messy-crm/commit/cbcc9f700c1127219560c58dcc6543b809fcced8))


## v0.2.2 (2026-10-25)

### Bug Fixes

- **ci**: Rename deploy to deploy to staging and add env url
  ([`9f614c3`](https://github.com/ekkysoftware/messy-crm/commit/9f614c3d5394f49221c937da7ec8af4c767f467b))


## v0.2.1 (2026-10-25)

### Bug Fixes

- **frontend**: Confirm deletes in a popup instead of window.confirm
  ([`d1c7c88`](https://github.com/ekkysoftware/messy-crm/commit/d1c7c88eecb5b6eea6e87f3b1450b34d70b9db6c))

### Chores

- Rearrange files structure
  ([`dd67bf8`](https://github.com/ekkysoftware/messy-crm/commit/dd67bf84b9c373a61f95f0350f8fd24b6fcf8da6))

- Update terraform lock file
  ([`832ded1`](https://github.com/ekkysoftware/messy-crm/commit/832ded1bdb40412fe41a5ad58727f27e76ddeb1a))

### Refactoring

- **crm**: Convert contact views to class-based views
  ([`6cf83aa`](https://github.com/ekkysoftware/messy-crm/commit/6cf83aa72f9c24c87ed22789e937005d2bcdf2a1))


## v0.2.0 (2026-10-24)

### Bug Fixes

- **ci**: Push to main vs pr, merge, to main can not deploy-prod issue
  ([`d5e3aff`](https://github.com/ekkysoftware/messy-crm/commit/d5e3affe67edfbcdbb04721eb675221aba4e7c73))

- **frontend**: Apply status filter on selection
  ([`0fef378`](https://github.com/ekkysoftware/messy-crm/commit/0fef37896b0c4defc5da2f4a6cbf63954b7edb58))

### Chores

- **test**: Add Django coverage reporting and CI gate
  ([`26465c7`](https://github.com/ekkysoftware/messy-crm/commit/26465c7722050a1c6d61a29df9a75dbf0c3eb0f6))

### Features

- **frontend**: Manage dashboard state with React Query
  ([`8661041`](https://github.com/ekkysoftware/messy-crm/commit/8661041f5b7c579168c50ff2d652832c05585b5c))


## v0.1.0 (2026-10-24)

- Initial Release

All notable changes to this project are documented here. Entries are generated
by `python-semantic-release` from Conventional Commits on `main`.
