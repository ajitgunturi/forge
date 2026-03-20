#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Creates a GitHub repository ruleset that:
#   • Blocks direct pushes to main (including admins/owners)
#   • Requires a PR with at least 1 approval
#   • Requires the CI status check to pass
#   • Blocks force-pushes and branch deletion
#
# Prerequisites: gh CLI authenticated with admin scope
# Usage:        ./scripts/setup-branch-protection.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Configuring ruleset for ${OWNER_REPO} → main"

gh api --method POST "/repos/${OWNER_REPO}/rulesets" \
  --input - <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "bypass_actors": [],
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": false,
        "require_code_owner_review": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_status_checks_policy": true,
        "required_status_checks": [
          {
            "context": "build-and-test",
            "integration_id": null
          }
        ]
      }
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "deletion"
    }
  ]
}
EOF

echo "✓ Ruleset created. No one (including you) can push directly to main."
echo "  All changes must go through a PR with 1 approval and passing CI."
