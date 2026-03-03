# Phase 12 UAT: Discussion Freshness And Category-Aware Answers

## Scenario 1: Cached local summary stays local

1. Seed `.forge/discussions` with an existing fetched run and prepared digest.
2. Run:
   `node "$HOME/.copilot/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "give me a summary of customer support discussions"`
3. Verify the answer returns from the prepared digest without requiring the user to ask for force sync.
4. Verify the output is grouped under real GitHub discussion categories.

## Scenario 2: Current-status request refreshes implicitly

1. Seed `.forge/discussions` with a stale prepared digest.
2. Run:
   `node "$HOME/.copilot/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "what is the current status of customer support discussions?"`
3. Verify Forge refreshes discussions without requiring `--force-refresh` or a user instruction to force sync.
4. Verify `.forge/discussions/analysis/latest-answer.json` records an implicit refresh decision and the parsed filters used.

## Scenario 3: Explicit dated request refreshes implicitly

1. Run:
   `node "$HOME/.copilot/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "count discussions created since 2026-01-01"`
2. Verify Forge fetches fresh discussion data automatically.
3. Verify the answer includes a count summary and category-grouped output.

## Scenario 4: Issue redirect stays terse

1. Run:
   `node "$HOME/.copilot/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "show me issues created in the last week"`
2. Verify the answer is a short discussions-only redirect rather than a long explanation.
3. Verify the redirect preserves the requested period by suggesting the equivalent discussions request.
