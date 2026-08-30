# RobBot3K operating contract

RobBot3K is Avalon's event-driven business-development engine. It is designed to automate everything leading up to a qualified discovery call: continuously collect demand signals, enrich opportunities, map decision makers, estimate strategic value, rank a morning action queue, prepare exact outreach, follow the approved cadence, update the commercial record, and learn from outcomes. Humans retain the decisions and relationships that matter.

The reviewed Regional Opportunity Atlas is the first connected signal source, not the whole engine. Concerts, festivals, corporate wellness, luxury residences, gyms, longevity clinics, hiring signals, and relevant regulatory signals can enter through additional source adapters as they are individually reviewed and connected.

## Event-driven engine

```text
signal observed
  -> source verification
  -> opportunity enrichment
  -> decision-maker mapping
  -> strategic-value scoring
  -> morning human approval queue
  -> approved bounded outreach
  -> reply or booking stop
  -> CRM outcome
  -> scoring feedback
```

This is a durable workflow graph, not a graph database. Every transition is tenant-scoped, timestamped, attributable, and replay-safe. Provider/model adapters may change without changing the human permission contract.

## Runtime truth for the first release

- Connected: Atlas signal import and diffing, source provenance, priority/confidence presentation, manual contact intake, native Avalon BD reconciliation, contact verification, exact four-message drafts, one-record approval, scheduled/manual runs, reply/booking/suppression stops, and attributed CRM outcome history.
- Human-operated: final source judgment, recipient verification, approval, custom replies, objections, pricing, clinical claims, and relationship ownership.
- Staged until configured: additional web scouts, model-based enrichment agents, automated decision-maker discovery, a compliant outreach-provider adapter, provider-native Calendly and reply webhooks, external CRM sync, and learned ranking weights.

The UI and API must never describe a staged adapter as connected runtime capability.

## Non-negotiable rule

Atlas review is evidence, not permission. A prospect may move from `ready_for_review` to `approved` only after an admin reviews the recipient, evidence, subject, message body, Calendly route, cadence, and stop conditions. No approval box is preselected.

## Daily flow

RobBot3K starts this flow at 6:00 AM in `America/Los_Angeles` every day. The same flow can be started manually by an admin at any time. A Pacific-local date key makes the scheduled run idempotent across daylight-saving time.

1. Fetch the Atlas with an immutable retrieval timestamp and content hash.
2. Parse only static literal datasets. Fail closed if the source becomes executable or the schema changes.
3. Diff records by stable Atlas ID. Preserve removed records as retired history.
4. Keep official evidence separate from discovery signals.
5. Treat emails found in Atlas prose as unverified contact candidates.
6. Draft a concise, evidence-backed email and bounded follow-ups.
7. Present the morning permission list in `/admin/robbot3k`.
8. Require an admin to verify the business email and approve the exact sequence snapshot.

## Approval scope

An approval authorizes one recipient, one organization, one approved message set, email only, and at most four touches on days 0, 3, 7, and 14. Approval expires after seven days if the initial message has not been sent. Editing the recipient, material claim, offer, message meaning, channel, cadence, or evidence snapshot invalidates the approval.

## Execution states

```text
discovered
  -> needs_research
  -> ready_for_review
  -> approved | held | rejected
  -> queued
  -> sent_waiting
       -> queued            next approved touch is due
       -> reply_review      any substantive reply
       -> suppressed        opt-out, complaint, or hard bounce
       -> booked            confirmed meeting
       -> exhausted         four approved touches completed
       -> paused            approval revoked or human takeover
```

Any reply stops the no-reply cadence. A positive reply may receive the approved Calendly link; questions, objections, pricing, clinical, legal, or custom requests return to human review. A referral creates a new prospect and requires new approval.

## Booking rule

RobBot3K may include Avalon's approved Calendly link or send it after explicit interest. It never fills out Calendly while pretending to be the recipient. A verified booking webhook or an admin's explicit `Mark booked` action is the source of truth. In this release, a booking stops the exact prospect sequence. Organization-wide stopping is staged until every prospect is joined by an explicit account ID; company-name or domain heuristics are not safe enough to mutate unrelated records.

Marking booked requires a valid future `scheduledAt`; a prospect cannot enter
the booked state with an undated meeting that would disappear from the upcoming
calls queue.

## Fail-closed checks before every send

- live sending is enabled server-side;
- Supabase, a policy-compatible outreach provider, sender, reply-to, Calendly URL, postal address, and clear opt-out language are configured;
- approval is active, unexpired, and matches the current prospect/message snapshot;
- the linked Avalon BD company and opportunity both exist, are active, and still match each other;
- recipient is a manually verified business address;
- recipient and domain are absent from the suppression table;
- there is no inbound reply, booking, or human takeover;
- the sequence is within the approved cadence and touch ceiling;
- an idempotency key has not already been used.

If any check cannot be completed, do not send.

Manual contact intake durably saves the RobBot research record and immediately
reconciles it into Avalon BD without sending or approving outreach. If CRM
reconciliation fails, the research record is retained and the API reports the
partial result explicitly. Deterministic reconciliation runs only from an
authenticated admin action. Outcome writes run only from that human action or
the exact persisted outreach approval checked by the send gate. The disabled
RobBot CRM identity is attribution, not general autonomous permission. A live
provider must remain disabled until these derivative permissions are enforced
transactionally through `bd_agent_permissions` or an equivalent exact-approval
RPC.

## Outreach boundaries

- US B2B email only for the first release.
- No automated SMS, calls, LinkedIn messages, social DMs, or contact-form submissions.
- Use public business information only. Never use PHI, inferred health status, protected traits, private data, or fabricated personalization.
- The current release executes one approved prospect sequence at a time. Organization-wide deduplication requires a future explicit account identifier.
- Use an accurate Avalon sender, truthful subject, valid postal address, monitored reply inbox, and clear opt-out.
- Honor opt-outs immediately and retain suppression records.
- Authenticate the sending domain and monitor delivery, bounce, and complaint signals.

Resend must not be used for scraped or cold outreach: its current [Acceptable Use Policy](https://resend.com/legal/acceptable-use) requires explicit recipient opt-in and prohibits cold outreach and scraped contact data. A human approval authorizes RobBot3K to act for Avalon; it does not create recipient consent. Live cold-B2B execution therefore requires a provider whose terms permit that use, plus Avalon's legal and deliverability review. Resend remains appropriate only for opted-in or transactional messages that satisfy its policy.

The controls are designed around the FTC's [CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) and Google's current [email sender guidelines](https://support.google.com/mail/answer/81126?hl=en). They do not replace legal review before live launch.

## Activation boundary

The page, research refresh, approval records, dry-run executor, and stop-state controls may be deployed before live sending. Real email remains disabled until a compatible provider adapter and the production environment are configured and an administrator deliberately sets `ROBBOT3K_LIVE_SEND_ENABLED=true`. That flag alone never enables a provider that has not been implemented and verified. The generic webhook is also disabled by default and is suitable only for a trusted Avalon-owned relay; Calendly and outreach-provider webhooks require their own native signature, timestamp, replay, and provider-binding verification before activation.
