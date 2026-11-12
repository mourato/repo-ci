# repo-ci

Shared AI workflows for my repositories.

- `opencode-review.yml`: automatic review on every non-draft PR, using OpenCode Go.
- `claude-mention.yml`: Claude Code runs when the owner comments `@claude` on a PR or issue.

## Add to a project repo

1. Copy `templates/ai.yml` to `.github/workflows/ai.yml`.
2. Set the secrets: `scripts/set-secrets.sh <repo>`.
