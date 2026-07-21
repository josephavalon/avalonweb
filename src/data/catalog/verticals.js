import { IV_SESSIONS } from './iv-sessions.js';
import { IV_ADDONS } from './iv-addons.js';
import { IM_SHOTS } from './im-shots.js';
import { PACKAGES } from './packages.js';
import { IV_CATEGORIES, IV_GOAL_RECOMMENDATION } from './categories.js';

export const VERTICALS = {
  iv_therapy: {
    slug: 'iv_therapy',
    label: 'IV Therapy',
    active: true,
    launchDate: '2026-05-01',
    sessions: IV_SESSIONS,
    addons: IV_ADDONS,
    shots: IM_SHOTS,
    packages: PACKAGES,
    categories: IV_CATEGORIES,
    goalRecommendation: IV_GOAL_RECOMMENDATION,
  },
};
