#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Creates a GitHub repository ruleset that:
#   • Blocks direct pushes to main for everyone
#   • Requires a PR with at least 1 approval (repo admin can bypass)
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
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "always"
    }
  ],
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "allowed_merge_methods": ["squash", "merge"],
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": false,
        "require_code_owner_review": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {
            "context": "build-and-test"
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

echo "✓ Ruleset created. Repo admin can bypass approvals; all others need 1 approval + passing CI."
