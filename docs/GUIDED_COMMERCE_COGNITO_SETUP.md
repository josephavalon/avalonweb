# Guided commerce: Cognito setup

The application-side prefill and receipt route are implemented. Complete these
form-owner steps in Cognito before accepting guided requests:

1. Add five Text fields with these exact internal names:
   `GuidedSource`, `GuidedTherapy`, `GuidedGoal`, `GuidedContext`, and
   `GuidedTiming`.
2. Mark all five fields Hidden and Protected. Do not use them in calculations,
   notification subjects, redirects, or other externally visible content.
3. Set the successful Submit action to redirect to the absolute production URL
   ending in `/start/received`. The redirect must contain no field tokens or
   query parameters.
4. Confirm the form is on Cognito's Enterprise plan, entry encryption is on,
   every patient field is Protected, and the BAA is signed and countersigned.
5. Validate prefilling and redirect behavior with synthetic entries only until
   every control in step 4 is confirmed.

Implementation references:

- Prefill allowlist: `src/lib/cognitoPrefill.js`
- Embed integration: `src/components/forms/CognitoFormEmbed.jsx`
- Receipt and deduplicated event: `src/pages/RequestReceived.jsx`

Cognito documentation:

- [Prefilling a form](https://www.cognitoforms.com/support/65/data-integration/prefilling-a-form)
- [HIPAA protected fields](https://www.cognitoforms.com/support/719/how-to-guides/create-hipaa-compliant-patient-intake-forms)

