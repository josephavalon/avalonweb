# Avalon iOS Browser QA Report

## 1. Executive Summary

**CONDITIONAL PASS — Ship Snooches After Listed Fixes**

The live snooches build passes the primary Jack Napier VIP/manual-billing booking test. The flow created a real Acuity appointment and synced a real Attio person without entering Stripe payment.

This is not a recommendation to touch or promote the main Avalon domains. `snooches.avalonvitality.co` points to the tested deployment; `www.avalonvitality.co` and `avalonvitality.co` remained on their prior deployment.

## 2. Test Environment

- Tested URL: `https://snooches.avalonvitality.co/`
- Tested deployment: `avalonweb-9q5wo965v-joseph-8775s-projects.vercel.app`, `dpl_FhkzQS7fwR6hygWzWL3Xv3hKGZe5`
- Main domains verified untouched: `www.avalonvitality.co` and `avalonvitality.co` still point to `avalonweb-rjpe1ssic-joseph-8775s-projects.vercel.app`
- Device/browser used: Playwright WebKit mobile iPhone profile
- Viewport: 393 x 659
- User agent: iPhone Safari/WebKit
- Test date/time: June 13, 2026, 10:00 PM Pacific
- Evidence: `.context/snooches-vip-live-result.json`, `.context/snooches-vip-*.png`

## 3. Primary Appointment Test

| Step | Action Taken | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 1 | Opened snooches booking flow | `/book` loads on mobile | Booking flow loaded | Pass | Evidence screenshot `snooches-vip-01-book-start.png` |
| 2 | Selected IV CBD | CBD category opens | CBD category opened | Pass |  |
| 3 | Selected CBD 99MG | 99mg CBD IV selected | Selected with $350 total | Pass |  |
| 4 | Selected no add-ons | Add-ons skipped | Advanced to scheduling | Pass |  |
| 5 | Selected October 14, 2026 | Date is selectable | Date selected | Pass | Booking horizon now includes requested date |
| 6 | Selected 7:00 PM | Time is selectable | Time selected | Pass | Acuity later confirmed `2026-10-14T19:00:00-0700` |
| 7 | Entered service address | Address/ZIP accepted | `1 Ferry Building San Francisco CA`, ZIP `94111` accepted | Pass |  |
| 8 | Entered Jack Napier contact info | Required fields accepted | Name, phone, DOB, email accepted | Pass | Email `jack.napier+qa-1781412956844@avalonvitality.co` |
| 9 | Entered emergency contact | Acuity-required field accepted | `Harley Quinn 4155550198` accepted | Pass | Added during audit because Acuity requires it |
| 10 | Selected VIP invoice | No Stripe payment required | VIP invoice selected, `$0` due today | Pass |  |
| 11 | Submitted `CONFIRM VIP` | Creates Acuity + Attio, no Stripe | `/api/manual-booking` returned HTTP 200 | Pass | No Stripe payment entered |
| 12 | Verified Acuity | Appointment exists | Acuity appointment `1721591936` exists | Pass | Type `IV CBD (33mg)`, calendar `AVALON VITALITY` |
| 13 | Verified Attio | Client exists | Attio person returned | Pass | Record `94903ea2-0906-51fb-827d-82ba562c6082` |

## 4. Booking Flow Result

- Acuity appointment created: **Yes**, appointment ID `1721591936`.
- Acuity readback: `IV CBD (33mg)`, Jack Napier, October 14, 2026 at 7:00 PM PDT, not canceled.
- Attio client created/synced: **Yes**, record ID `94903ea2-0906-51fb-827d-82ba562c6082`.
- Stripe payment completed: **No.** The flow used VIP invoice/manual billing and did not enter Stripe payment.
- VIP note preserved in request payload: **Yes:** `VIP customer. Do not charge now. Bill manager later.`

## 5. Critical Defects

No remaining critical defect blocks the primary snooches VIP booking path.

Critical defects found during the audit were fixed and redeployed to snooches:

- Attio rejected the initial request until phone normalization sent E.164-style phone numbers.
- Acuity rejected the request because emergency contact was required but the booking UI did not expose or require it.
- The final deployed build now exposes emergency contact and blocks final submit until it is filled.

## 6. Functional Defects

- Confirmation page opened cold at `/booking/confirmation?appointment=1721591936&manual=1` renders “Request Received” but does not show full appointment details from Acuity. Required fix: load authoritative service/date/customer summary for manual confirmations.
- Product route `/products/cbd/cbd-33mg` returns HTTP 200, but route title remains generic. Required fix: verify the product detail renders the intended CBD detail page and metadata.

## 7. Visual Defects

- Mobile review screen has dense typography and the sticky footer truncates “Balance after visit” at the bottom of the iPhone viewport.
- Confirmation screen needs stronger detail presentation for manual/VIP bookings.

## 8. Conversion Defects

- The primary conversion path now works for VIP invoice booking.
- Remaining risk: if confirmation details stay sparse, users may not have enough post-submit reassurance without staff follow-up.

## 9. Accessibility Defects

- The newly added emergency contact field is reachable as `Emergency contact`.
- No console errors or failed requests were observed in the passing run.
- Further keyboard/screen-reader audit was not performed in this pass.

## 10. Security / Privacy Defects

- No real PHI was used; only Jack Napier QA data was entered.
- No Stripe charge was attempted.
- Confirmation URL includes the Acuity appointment id in the query string. Review whether this is acceptable for public confirmation links.
- Admin route returned HTTP 200 to the login boundary; no unauthenticated admin data was observed.

## 11. Dead Links and Broken CTAs

| Page/Route | Result |
|---|---|
| `/` | HTTP 200 |
| `/book` | HTTP 200 |
| `/protocols` | HTTP 200 |
| `/services/cbd` | HTTP 200 |
| `/products/cbd/cbd-33mg` | HTTP 200, needs product-detail verification |
| `/login` | HTTP 200 |
| `/signup` | HTTP 200 |
| `/forgot` | HTTP 200 |
| `/admin/login` | HTTP 200 login boundary |
| `/terms-of-service` | HTTP 200 |
| `/privacy-policy` | HTTP 200 |
| `/subscription` | HTTP 200 |
| `/launches` | HTTP 200 |

## 12. Forms and Inputs Tested

| Field | Value Entered | Result |
|---|---|---|
| Name | `Jack Napier` | Accepted |
| Phone | `4155550199` | Accepted; sent to Attio normalized |
| DOB | `01/01/1980` | Accepted |
| Email | `jack.napier+qa-1781412956844@avalonvitality.co` | Accepted |
| Emergency contact | `Harley Quinn 4155550198` | Accepted |
| Address | `1 Ferry Building San Francisco CA 94111` | Accepted |
| Date | October 14, 2026 | Accepted |
| Time | 7:00 PM | Accepted |
| Billing | VIP invoice | Accepted; `$0` due today |

## 13. Mobile Viewport Defects

- Sticky footer consumes significant space on 393 x 659 viewport.
- Bottom summary copy truncates on the final review step.
- The flow remains usable despite the density.

## 14. Performance Observations

- Booking flow loaded and completed without visible stuck loaders.
- Passing run completed in about 11.5 seconds under automated mobile WebKit.
- No failed network requests or browser console errors were captured in the passing run.

## 15. Required Fix List

- Keep the emergency contact field and validation in the final booking build.
- Improve manual confirmation page so it displays authoritative Acuity appointment details after reload/cold open.
- Review public confirmation URL exposure of Acuity IDs.
- Polish mobile review footer truncation.
- Confirm whether the real Acuity QA appointment `1721591936` should remain or be canceled after stakeholder review.

## 16. Final Ship Recommendation

**Ship snooches only with conditions.**

The primary Jack Napier VIP booking now creates both the Acuity appointment and Attio client with no Stripe charge. Do not promote this to the main Avalon domains until the remaining confirmation-detail and mobile polish items are accepted or fixed.
