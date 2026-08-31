import { useEffect } from 'react';
import { pingIntakeAlert } from '@/lib/intakeAlert';

/**
 * Watches for Cognito's own success class and pings the admin-alert endpoint.
 * Renders nothing.
 *
 * ── WHY AN OBSERVER AND NOT COGNITO'S CALLBACK ──────────────────────────────
 * Cognito exposes an afterSubmit hook, but it hands the callback the entry
 * object — every field the visitor typed. Attaching it would put PHI inside an
 * Avalon function, which is precisely what src/components/forms/
 * CognitoFormEmbed.jsx's header forbids. This watches the DOM instead and never
 * learns anything about the submission except that it happened.
 *
 * ── WHY THIS IS SAFE DESPITE WATCHING A SUBTREE FULL OF PHI ─────────────────
 * Since the 2026-07-31 move to seamless.js the form's inputs are real nodes in
 * Avalon's DOM, so an observer here is genuinely near patient data. The
 * containment is `attributeFilter: ['class']`: the callback can only ever be
 * handed class-attribute mutations, so it is not possible for a field value to
 * reach this code. Nothing below reads .value, .textContent, .innerText or
 * FormData, and nothing queries for an input. scripts/front-door-qa.mjs asserts
 * all of that, because the safety here is the discipline, not the intent.
 */
export default function CognitoSubmitPing({ source = 'start' }) {
  useEffect(() => {
    let done = false;

    const isSuccess = (node) =>
      node instanceof Element
      && node.classList.contains('cog-form')
      && node.classList.contains('is-success');

    const fire = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      pingIntakeAlert(source);
    };

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (isSuccess(record.target)) {
          fire();
          return;
        }
      }
    });

    // Cognito can flip the class before this effect runs (bfcache restore, a
    // fast submit, a remount). Check once so that race doesn't cost an alert.
    if (document.querySelector('.cog-form.is-success')) {
      fire();
    } else {
      observer.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    return () => observer.disconnect();
  }, [source]);

  return null;
}
