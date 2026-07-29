# Avalon Guided Selection Flow

## Objective

Help a visitor choose a wellness starting point without diagnosing themselves, while showing no more than three primary choices on any screen.

The shortest viable path is:

`Support lane → Support category → Starting point → Name and mobile`

Timing, party size, contraindications, clinical history, protocol, dose, and final service selection belong in the clinician-reviewed intake rather than the marketing recommendation.

## Global navigation

- Back: returns one screen.
- View all services / View full menu: routes to `/protocols`.
- Avalon logo: routes home.
- No top navigation menu appears in the guided flow.
- Selections stay in React memory only. They are not written to URLs, local storage, analytics, or advertising pixels.

## Screen 1

### Heading

What would you like to support?

### Choices

1. **Recovery**  
   Hydration, travel, and getting back to routine.
2. **Optimization**  
   Energy, performance, and everyday wellness.
3. **Longevity**  
   Weight management, cellular wellness, and healthy aging.

Secondary link: **View all services**

## Screen 2: Recovery

### Heading

What kind of recovery support?

### Choices

1. **Hydration Support**  
   Fluid replenishment and routine wellness.
2. **Travel Support**  
   Wellness support around demanding travel days.
3. **Post-Event Support**  
   Hydration and replenishment after high-output events.

## Screen 2: Optimization

### Heading

What would you like to optimize?

### Choices

1. **Energy Support**  
   Everyday energy and wellness routines.
2. **Performance Support**  
   Support for high-output days.
3. **Appearance Support**  
   Hydration and nutrient-focused wellness.

## Screen 2: Longevity

### Heading

What would you like to explore?

### Choices

1. **Weight Management**  
   A clinician-reviewed starting point.
2. **Cellular Wellness**  
   Advanced wellness options, including NAD+.
3. **Healthy Aging**  
   Long-term wellness goals and clinician review.

## Recommendation map

| Lane | Category | Current starting point | Recommendation copy | Availability |
|---|---|---|---|---|
| Recovery | Hydration Support | Hydration IV | Designed to support fluid replenishment and help you return to your routine. | Bookable request |
| Recovery | Travel Support | Jet Lag IV | Designed to support hydration and wellness around demanding travel days. | Bookable request |
| Recovery | Post-Event Support | Post-Night-Out IV | Designed to support hydration and replenishment after high-output events. | Bookable request |
| Optimization | Energy Support | Energy IV | Designed around energy support and everyday wellness goals. | Bookable request |
| Optimization | Performance Support | Performance Support | Designed to support high-output days and performance-focused routines. | Bookable request |
| Optimization | Appearance Support | Beauty IV | Hydration and nutrient support designed around appearance-focused wellness goals. | Bookable request |
| Longevity | Weight Management | Weight Management | This category is not available for online recommendation yet. Explore current services or ask a concierge. | Concierge inquiry only |
| Longevity | Cellular Wellness | NAD+ | A clinician-reviewed option designed around cellular wellness goals. | Bookable request, clinician reviewed |
| Longevity | Healthy Aging | Healthy Aging | This category is not available for online recommendation yet. Explore current services or ask a concierge. | Concierge inquiry only |

## Recommendation screen

Eyebrow: **A starting point for review**

Selection line: **{Support lane} · {Support category}**

The screen shows one service or category, one support-oriented explanation, and these actions:

1. **Book now** for currently available services, or **Ask a concierge** for unavailable future categories.
2. **Compare options**
3. **View full menu**

Required note:

> Booking submits a request. Final eligibility and service selection are determined through clinician review. Your appointment is confirmed after the $50 deposit is paid.

## Compare screen

The compare screen shows exactly three choices: the selected support category and the other two categories within the same support lane. The current selection uses a stronger border and a check icon.

Selecting a different category returns to the recommendation screen. **View full menu** remains visible.

## Booking screen

Currently available services request:

> Your name and mobile. We’ll verify your request, then text you a $50 deposit link.

Unavailable category inquiry:

> Your name and mobile. A concierge will follow up about this category.

Unavailable-category requests explicitly state that the inquiry does not create an appointment or guarantee service availability.

## Interaction states

- Hover: border contrast and surface opacity increase slightly; arrow moves forward.
- Selected: stronger border, slightly stronger neutral fill, and check icon.
- Back: circular arrow control returns one screen without losing the prior lane.
- Transition: 280 ms opacity and vertical movement using the existing Avalon motion curve.
- Reduced motion: the project’s existing reduced-motion CSS remains authoritative.

## Responsive layout

### Desktop

- Question screen: question rail on the left, three stacked choices on the right.
- Recommendation: existing product bag or category icon on the left; copy and actions on the right.
- Compare: question rail on the left, three selectable options on the right.
- Footer begins at or below the initial viewport.

### Mobile

- One stacked column.
- All three primary choices and the full-menu link fit in the first viewport.
- The recommendation’s primary action remains above a conservative mobile-browser toolbar boundary.
- Footer begins at or below the initial viewport.

## Compliance notes

These notes guide copy and interface behavior; they are not a substitute for legal or clinical review.

- **Recovery:** navigational wellness goal only; do not imply treatment of injury or illness.
- **Optimization:** do not promise quantified energy or performance gains.
- **Longevity:** do not claim life extension, anti-aging, age reversal, or disease-risk reduction.
- **Hydration Support:** use fluid-replenishment support language; do not diagnose or claim to treat dehydration.
- **Travel Support:** do not claim illness prevention, immune protection, or a jet-lag cure.
- **Post-Event Support:** do not use hangover cure, detox, nausea-relief, or pain-treatment claims.
- **Energy Support:** do not diagnose or treat fatigue; avoid guaranteed energy outcomes.
- **Performance Support:** describe active routines, not performance enhancement or guaranteed results.
- **Appearance Support:** do not imply treatment of acne or hair loss, or guarantee skin outcomes.
- **Weight Management:** do not automatically map to an IV or IM service. No fat-burning, pounds-lost, or guaranteed-results language.
- **Cellular Wellness:** navigation label only. Do not claim cellular repair, rejuvenation, or mechanistic NAD+ outcomes.
- **Healthy Aging:** navigation label only. Do not claim anti-aging, reversal, or lifespan extension.
- **Clinical boundary:** Avalon presents educational starting points. A licensed clinician determines eligibility, protocol, dose, contraindications, and final treatment.
- **HIPAA boundary:** once choices are tied to name or mobile, send them only through a properly configured vendor after confirming the applicable BAA and safeguards. Do not send them to advertising or session-replay tools.

Official reference points:

- [FDA: Structure/Function Claims](https://www.fda.gov/food/food-labeling-nutrition/structurefunction-claims)
- [FTC: Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
- [HHS: Business Associates](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html)
- [HHS: Online Tracking Technologies](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/hipaa-online-tracking/index.html)

## Desktop board

The implementation board showing the first selection, branch selection, recommendation, and compare states is saved at:

`.context/avalon-guided-flow-desktop-board.png`
