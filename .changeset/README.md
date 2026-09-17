# Changesets

This directory is used by [Changesets](https://github.com/changesets/changesets) to manage releases.

When you make a change that should be released, run `pnpm changeset` and follow the prompts. It writes a small markdown file describing the change and the version bump (patch/minor/major) it warrants. Commit that file alongside your change.

When changesets are merged to `main`, running `pnpm changeset version` consumes them: it bumps `package.json`'s version and writes the entries into `CHANGELOG.md`. Publishing to npm (`pnpm changeset publish` after building) is a separate, manual step for now.
