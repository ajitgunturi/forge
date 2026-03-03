# Phase 12: Discussion Freshness And Category-Aware Answers - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** User feedback from Copilot runtime usage on 2026-03-03

<domain>
## Phase Boundary

This phase improves the installed `forge-discussion-analyzer` behavior around freshness, scope correction, and output structure.

The phase must:

- auto-refresh discussion data when the user explicitly asks for current/fresh/latest status or for discussions from a certain date or time period
- continue using local artifacts when the request is satisfied by already-fetched local discussion data
- stop making the user instruct the agent to "force sync" or "force fetch" for explicit time-scoped discussion requests
- redirect GitHub Issue questions back to Discussions briefly instead of producing a long explanation
- group answer content under the real GitHub discussion categories present in the repository and show the relevant details inside each category section

This phase is about discussion-analyzer behavior and support ergonomics. It is not about adding GitHub Issues support, broadening assistant coverage, or changing the overall install/runtime model.
</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- If the user explicitly asks for current/fresh/latest discussion status, or for discussions from a specific date, datetime, or requested time period, the workflow should implicitly do a forced fetch/refresh without requiring a user instruction.
- If the user asks for issues, the analyzer should answer tersely that it handles discussions only and ask whether the user wants discussions for the requested period instead.
- Answers should classify discussions using the GitHub categories available in the fetched dataset and show relevant information under those categories.
- Existing local discussion artifacts remain valid for requests that are clearly about summaries, themes, or gap analysis over already-present local information rather than freshness-sensitive current-status or time-slice requests.

### Claude's Discretion

- How to detect when a time-scoped request is freshness-sensitive enough to force refresh automatically
- Whether freshness detection lives in the analyzer layer, a request parser, or shared discussion filter utilities
- The exact answer shape for category-grouped summaries, counts, and per-discussion details
- Whether classification should rely only on GitHub category names or also include the existing derived `kind` and `status` signals inside each category section
- How much structured metadata to persist in analysis traces so later support debugging can explain why a refresh did or did not happen
</decisions>

<specifics>
## Specific Ideas

- Detect phrases like "current status", "latest status", "from January 1 2026", "created today", "between 2026-01-01 and 2026-01-31", and datetime-specific requests as freshness triggers for implicit refresh
- Keep a short redirect such as "Forge analyzes GitHub Discussions only. Want discussions from that time period instead?" rather than a multi-paragraph correction
- Add answer sections that start with category headers such as `Customer Support`, `Bug`, or `Ideas`, then show counts, resolution state, and matching discussion summaries inside each section
- Preserve the current derived `kind` and `status` fields so category sections can still surface themes like unresolved bugs or answered consultations
- Add tests that mirror the user log where the first answer used stale local context and the corrected behavior should force refresh automatically
</specifics>

<deferred>
## Deferred Ideas

- Full GitHub Issues ingestion or unified issues-plus-discussions analysis
- Background scheduled sync of discussions independent of user requests; current Forge has no periodic sync scheduler today
- Rich time parsing for natural language beyond the date and window formats already supported by Forge
- Cross-assistant policy tuning outside the installed Copilot summonable path
</deferred>

---

*Phase: 12-discussion-freshness-and-category-aware-answers*
*Context gathered: 2026-03-03 from direct user feedback on discussion-analyzer behavior*
