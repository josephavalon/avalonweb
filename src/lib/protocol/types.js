/**
 * Avalon Protocol primitive.
 *
 * A Protocol is the atomic unit of the platform — a member-specific bundle
 * of diagnostics + intervention + monitoring across one or more Verticals.
 * Every vertical (IV, Peptides, TRT, Aesthetics, Diagnostics, Supplements)
 * is a configuration on top of this shape, not a bespoke subsystem.
 *
 * Design rules:
 *   1. Every field is optional by design — new verticals should not require
 *      schema migrations, just new enum values and new Modality configs.
 *   2. Pricing lives on Modality, never on Vertical. A Vertical has many
 *      Modalities; a Modality has one price point.
 *   3. Status transitions are additive — never mutate history.
 *   4. FDA-safe framing is enforced at the copy layer (src/content/), not
 *      here. This file defines structure, not therapeutic claims.
 *
 * @typedef {'iv' | 'nad' | 'cbd' | 'peptides' | 'trt' | 'aesthetics' | 'diagnostics' | 'supplements' | 'nutrition'} VerticalId
 *
 * @typedef {'live' | 'beta' | 'roadmap' | 'research'} VerticalStatus
 *
 * @typedef {Object} Vertical
 * @property {VerticalId} id
 * @property {string}     label              User-facing name
 * @property {string}     tagline            Short editorial line (FDA-safe)
 * @property {VerticalStatus} status
 * @property {string}     [launchQuarter]    e.g. '2026-Q3' — for roadmap items
 * @property {string}     [icon]             lucide-react icon name
 * @property {string[]}   [modalityIds]      Ordered list of Modality ids in this vertical
 *
 * @typedef {Object} Modality
 * @property {string}     id                 Stable slug, used in URLs + events
 * @property {VerticalId} verticalId
 * @property {string}     name
 * @property {string}     [shortName]
 * @property {number}     [priceOneTime]     USD; undefined = member-only or not for single purchase
 * @property {number}     [priceMember]      USD after member discount
 * @property {number}     [credits]          Cost in membership credits
 * @property {number}     [durationMinutes]
 * @property {string[]}   [ingredients]      Educational list — never therapeutic claims
 * @property {string}     [disclaimer]       Override for the default vertical disclaimer
 * @property {boolean}    [requiresIntake]   True for anything with an Rx or clinical screen
 * @property {boolean}    [inStudioOnly]
 *
 * @typedef {Object} MembershipTier
 * @property {'starter' | 'premium' | 'vip'} id
 * @property {string} name
 * @property {number} monthlyPrice
 * @property {number} creditsPerMonth
 * @property {string[]} perks
 * @property {number} [presaleDiscount]  % discount locked in at presale
 *
 * @typedef {Object} Protocol
 * @property {string}      id               UUID
 * @property {string}      memberId
 * @property {string}      name             e.g. 'Founder Performance Protocol'
 * @property {VerticalId[]} verticalIds     Verticals this Protocol spans
 * @property {string[]}    modalityIds      Modalities included
 * @property {'draft' | 'active' | 'paused' | 'archived'} status
 * @property {Date}        createdAt
 * @property {Date}        [startedAt]
 * @property {Date}        [endedAt]
 * @property {string}      [supervisingPhysicianId]
 * @property {Object[]}    [events]         Append-only event log (bookings, labs, follow-ups)
 */

// Runtime-safe enum mirrors. Use these instead of string literals in application
// code so we get a single source of truth for what's valid.
export const VERTICAL_STATUS = Object.freeze({
  LIVE: 'live',
  BETA: 'beta',
  ROADMAP: 'roadmap',
  RESEARCH: 'research',
});

export const PROTOCOL_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
});

export const MEMBERSHIP_TIER = Object.freeze({
  STARTER: 'starter',
  PREMIUM: 'premium',
  VIP: 'vip',
});
