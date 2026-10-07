# Fork notes

This is a fork of [floci-io/floci](https://github.com/floci-io/floci). Fork patches are
built only on top of upstream semver releases, never on unreleased upstream `main`.

## Branches

- `main`: full mirror of upstream `main`. Never commit to it. Branch from it to contribute upstream.
- `upstream-release`: fast-forwarded to the latest upstream release tag (`X.Y.Z`). Never commit to it.
- `fork/main`: default branch. An upstream release plus fork-only patches.

```
floci-io release tag -> djbender/upstream-release -> (PR, merge commit) -> djbender/fork/main
```

## Syncing

`.github/workflows/sync-upstream.yml` runs daily. It fast-forwards `main`, moves
`upstream-release` to the latest upstream release (pre-releases are ignored) and opens an
`upstream-release` -> `fork/main` PR. Merge it with **Create a merge commit**, never squash or rebase.

If a fast-forward is blocked (the update changed workflow files, which `GITHUB_TOKEN` cannot
push), an `upstream-sync` issue is opened with the commands. They are:

    gh repo sync djbender/floci -b main
    git fetch upstream --tags
    git push origin X.Y.Z^{commit}:refs/heads/upstream-release X.Y.Z

## Versions and images

Merging a new upstream release into `fork/main` triggers `.github/workflows/fork-release.yml`.
It tags `X.Y.Z+fork.1`, builds the images and creates a GitHub release. Images in
`ghcr.io/djbender/floci`:

- `X.Y.Z-fork.N`, `X.Y.Z-fork`, `latest` (JVM)
- the same with `-native` and `-native-compat` suffixes

For a fork-only fix on the same release, run **Fork Release** manually with `bump` ticked to
cut `X.Y.Z+fork.N+1`. Other pushes to `fork/main` do not build. **Fork Images** remains for
ad hoc builds of any ref.

## Conflicts

    git fetch origin
    git switch -c sync/upstream-$(date +%F) origin/fork/main
    git merge origin/upstream-release
    # resolve, commit, push, open a PR into fork/main
