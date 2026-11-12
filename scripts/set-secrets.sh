#!/usr/bin/env bash
# Set the two AI secrets in the given repos. Values are read from the
# environment and never printed.
# Usage: OPENCODE_API_KEY=... CLAUDE_CODE_OAUTH_TOKEN=... scripts/set-secrets.sh repo1 repo2 ...
set -euo pipefail
: "${OPENCODE_API_KEY:?missing}" "${CLAUDE_CODE_OAUTH_TOKEN:?missing}"
for repo in "$@"; do
  gh secret set OPENCODE_API_KEY --repo "mourato/$repo" --body "$OPENCODE_API_KEY"
  gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo "mourato/$repo" --body "$CLAUDE_CODE_OAUTH_TOKEN"
  echo "ok: $repo"
done
