# Acuity Appointment Type Mapping

Fill the live Acuity Appointment Type ID column from the Acuity dashboard. Values are not treated as secrets, but they should match the live account before accepting payments.

| Env var | Live Acuity Appointment Type ID | Maps to |
| --- | --- | --- |
| `ACUITY_DEFAULT_TYPE_ID` | TODO | Server fallback when no specific mapping matches |
| `ACUITY_TYPE_IV_VITAMINS` | TODO | One-time IV vitamin drips and generic IV fallback |
| `ACUITY_TYPE_IV_NAD` | TODO | NAD IV protocols and NAD sessions |
| `ACUITY_TYPE_IV_CBD` | TODO | CBD IV protocols |
| `ACUITY_TYPE_IM_SHOTS` | TODO | IM shots: B12, Glutathione, MIC, NAD+ shot |
| `ACUITY_TYPE_MEMBERSHIP` | TODO | Membership/plan first visits and recurrences |
| `ACUITY_TYPE_HYDRATION` | TODO | Hydration protocol |
| `ACUITY_TYPE_ENERGY` | TODO | Energy protocol |
| `ACUITY_TYPE_IMMUNITY` | TODO | Immunity protocol |
| `ACUITY_TYPE_BEAUTY` | TODO | Beauty protocol |
| `ACUITY_TYPE_RECOVERY` | TODO | Recovery protocol |
| `ACUITY_TYPE_JETLAG` | TODO | Jet lag protocol |
| `ACUITY_TYPE_MYERS` | TODO | Myers protocol |
| `ACUITY_TYPE_HANGOVER` | TODO | Hangover/post-night protocol |
| `VITE_ACUITY_DEFAULT_TYPE_ID` | TODO | Frontend fallback availability lookup |
| `VITE_ACUITY_TYPE_HYDRATION` | TODO | Frontend hydration availability lookup |
| `VITE_ACUITY_TYPE_MYERS` | TODO | Frontend Myers availability lookup |
| `VITE_ACUITY_TYPE_ENERGY` | TODO | Frontend energy availability lookup |
| `VITE_ACUITY_TYPE_IMMUNITY` | TODO | Frontend immunity availability lookup |
| `VITE_ACUITY_TYPE_BEAUTY` | TODO | Frontend beauty availability lookup |
| `VITE_ACUITY_TYPE_RECOVERY` | TODO | Frontend recovery availability lookup |
| `VITE_ACUITY_TYPE_HANGOVER` | TODO | Frontend hangover availability lookup |
| `VITE_ACUITY_TYPE_JETLAG` | TODO | Frontend jet lag availability lookup |
| `VITE_ACUITY_TYPE_IV_NAD` | TODO | Frontend NAD availability lookup |
| `VITE_ACUITY_TYPE_IV_CBD` | TODO | Frontend CBD availability lookup |
| `VITE_ACUITY_TYPE_IM_SHOTS` | TODO | Frontend IM shot availability lookup |
| `VITE_ACUITY_TYPE_MEMBERSHIP` | TODO | Frontend plan availability lookup |
| `VITE_ACUITY_TYPE_EVENT` | TODO | Frontend event availability lookup |
| `VITE_ACUITY_TYPE_EVENT_PRESALE` | TODO | Frontend event presale availability lookup |

Verification:

```bash
STRIPE_SECRET_KEY=sk_test_... ACUITY_VERIFY=1 npm run verify:booking-to-acuity
```
