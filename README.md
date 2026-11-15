# repo-ci

Shared AI workflows for my repositories.

- `opencode-review.yml`: automatic review on every non-draft PR, using OpenCode Go.
- `claude-mention.yml`: Claude Code runs when the owner comments `@claude` on a PR or issue.

## Add to a project repo

1. Copy `templates/ai.yml` to `.github/workflows/ai.yml`.
2. Set the secrets: `scripts/set-secrets.sh <repo>`.

## Review result

The `auto-review / review` check reflects the review findings. It fails when
`blocker` or `should` is greater than zero; optional `nit` findings do not fail
it. The full review remains a PR comment. This workflow does not submit a
formal approval or request-changes review.

The check accepts only the comment posted by `github-actions[bot]` for the
current run and attempt, with a valid `REVIEW_SUMMARY` for the reviewed head.
A missing, malformed, or ambiguous result fails the check. OpenCode or GitHub
API errors also fail it. Fork and Dependabot reviews remain skipped.

After a new push, the next review can pass once required findings are resolved
or settled through the existing `CI triage` procedure. Repositories calling
the shared workflow at `@main` receive the change when it is merged here;
their workflow template needs no update. To prevent merging on GitHub, make
`auto-review / review` a required check in the target branch's protection or
ruleset, where the repository's plan supports it. A failing optional check
alone does not prevent a merge.

## Local validation

Run `make check` with Node.js 22 or later. The tests execute the scripts from
the reusable workflow with a simulated GitHub API, including clean and failing
reviews, closure rounds, stale or untrusted comments, and invalid summaries.
