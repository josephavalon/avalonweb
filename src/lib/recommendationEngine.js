const GOAL_PRIMARY_WEIGHT = 7;
const GOAL_SECONDARY_WEIGHT = 4;
const CONTEXT_EXACT_WEIGHT = 10;
const CONTEXT_RELATED_WEIGHT = 5;

/**
 * @typedef {import('@/data/guidedCommerce').GuidedAnswers} GuidedAnswers
 * @typedef {import('@/data/guidedCommerce').Offering} Offering
 */

/**
 * @typedef {Object} OfferingScore
 * @property {string} therapyId
 * @property {number} score
 * @property {string[]} reasons
 * @property {Offering} offering
 */

/**
 * @typedef {Object} RecommendationResult
 * @property {GuidedAnswers} answers
 * @property {OfferingScore[]} recommendations
 */

function scoreDimension(value, primary, secondary, primaryWeight, secondaryWeight) {
  if (primary.includes(value)) return { score: primaryWeight, matched: true };
  if (secondary.includes(value)) return { score: secondaryWeight, matched: true };
  return { score: 0, matched: false };
}

/**
 * Rank eligible offerings without mutating the answers or catalog.
 * @param {GuidedAnswers} answers
 * @param {Offering[]} offerings
 * @param {number} limit
 * @returns {RecommendationResult}
 */
export function rankOfferings(answers, offerings, limit = 3) {
  const safeAnswers = Object.freeze({
    goal: String(answers?.goal || ''),
    context: String(answers?.context || ''),
    timing: String(answers?.timing || ''),
  });

  const ranked = offerings
    .filter((offering) => offering?.enabled !== false && offering?.recommendable !== false)
    .map((offering) => {
      const goal = scoreDimension(
        safeAnswers.goal,
        offering.rules.primaryGoals,
        offering.rules.secondaryGoals,
        GOAL_PRIMARY_WEIGHT,
        GOAL_SECONDARY_WEIGHT,
      );
      const context = scoreDimension(
        safeAnswers.context,
        offering.rules.exactContexts,
        offering.rules.relatedContexts,
        CONTEXT_EXACT_WEIGHT,
        CONTEXT_RELATED_WEIGHT,
      );
      const timingScore = Number(offering.rules.timing[safeAnswers.timing] || 0);
      const reasons = [];
      if (goal.matched) reasons.push(`goal:${safeAnswers.goal}`);
      if (context.matched) reasons.push(`context:${safeAnswers.context}`);
      if (timingScore > 0) reasons.push(`timing:${safeAnswers.timing}`);
      return {
        therapyId: offering.id,
        score: goal.score + context.score + timingScore,
        reasons,
        offering,
      };
    })
    .sort((left, right) => (
      right.score - left.score
      || left.offering.priority - right.offering.priority
      || left.therapyId.localeCompare(right.therapyId)
    ));

  const seen = new Set();
  const recommendations = [];
  for (const score of ranked) {
    if (seen.has(score.therapyId)) continue;
    seen.add(score.therapyId);
    recommendations.push(score);
    if (recommendations.length >= Math.max(0, limit)) break;
  }

  return { answers: safeAnswers, recommendations };
}

export default rankOfferings;
