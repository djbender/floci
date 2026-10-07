# Fork notes

This is a fork of [floci-io/floci](https://github.com/floci-io/floci).

## Branches

- `main`: mirror of upstream `main`. Never commit to it.
- `fork/main`: default branch. Carries fork-only patches.

```
floci-io/main -> djbender/main -> (PR, merge commit) -> djbender/fork/main
```

## Syncing

`.github/workflows/sync-upstream.yml` runs daily. It fast-forwards `main` and opens a
`main` -> `fork/main` PR. Merge it with **Create a merge commit**, never squash or rebase.

If the fast-forward is blocked (upstream changed workflow files), an `upstream-sync` issue
is opened. Run:

    gh repo sync djbender/floci -b main

## Conflicts

    git fetch origin
    git switch -c sync/upstream-$(date +%F) origin/fork/main
    git merge origin/main
    # resolve, commit, push, open a PR into fork/main

## Contributing upstream

Branch from `main`, not `fork/main`.
