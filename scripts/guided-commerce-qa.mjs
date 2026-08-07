import assert from 'node:assert/strict';
import {
  GUIDED_CONTEXTS,
  GUIDED_GOALS,
  GUIDED_OFFERINGS,
  GUIDED_TIMINGS,
  buildGuidedStartPath,
} from '../src/data/guidedCommerce.js';
import { rankOfferings } from '../src/lib/recommendationEngine.js';
import { sanitizeCognitoPrefill } from '../src/lib/cognitoPrefill.js';

const expectTop = (answers, expected) => {
  const result = rankOfferings(answers, GUIDED_OFFERINGS);
  assert.equal(result.recommendations[0]?.therapyId, expected, JSON.stringify({ answers, result }));
};

expectTop({ goal: 'recover', context: 'workout', timing: 'today' }, 'recovery');
expectTop({ goal: 'feel-better', context: 'dehydrated', timing: 'today' }, 'hydration');
expectTop({ goal: 'recover', context: 'night-out', timing: 'today' }, 'night-out');
expectTop({ goal: 'feel-better', context: 'travel-fatigue', timing: 'this-week' }, 'jet-lag');
expectTop({ goal: 'immunity', context: 'prevention', timing: 'ongoing' }, 'immunity');
expectTop({ goal: 'performance', context: 'athletic-performance', timing: 'this-week' }, 'performance');
expectTop({ goal: 'long-term-wellness', context: 'cellular-health', timing: 'ongoing' }, 'nad-250');

for (const goal of GUIDED_GOALS) {
  for (const context of GUIDED_CONTEXTS[goal.id].options) {
    for (const timing of GUIDED_TIMINGS) {
      const answers = { goal: goal.id, context: context.id, timing: timing.id };
      const original = JSON.stringify(answers);
      const result = rankOfferings(answers, GUIDED_OFFERINGS);
      assert.equal(result.recommendations.length, 3);
      assert.equal(new Set(result.recommendations.map((item) => item.therapyId)).size, 3);
      assert.equal(JSON.stringify(answers), original, 'rankOfferings mutated answers');
      assert.ok(result.recommendations.every((item) => item.offering.enabled && item.offering.recommendable));
    }
  }
}

const excluded = new Set(['cbd', 'food-poisoning', 'beauty', 'nad-500', 'nad-750', 'nad-vitality', 'nad-1000', 'nad-1250', 'nad-1500']);
const sample = rankOfferings(
  { goal: 'long-term-wellness', context: 'stress-relaxation', timing: 'ongoing' },
  GUIDED_OFFERINGS,
  20,
);
assert.ok(sample.recommendations.every((item) => !excluded.has(item.therapyId)));

const nad = GUIDED_OFFERINGS.find((offering) => offering.id === 'nad-250');
assert.equal(buildGuidedStartPath(nad), '/start?therapy=nad-250&protocol=nad&source=guided&dose=nad_250');

assert.deepEqual(sanitizeCognitoPrefill({
  GuidedSource: ' Guided commerce ',
  GuidedTherapy: 'Recovery IV',
  GuidedGoal: 'Recover',
  GuidedContext: 'Workout',
  GuidedTiming: 'Today',
  Name: 'must not pass',
  Phone: 'must not pass',
}), {
  GuidedSource: 'Guided commerce',
  GuidedTherapy: 'Recovery IV',
  GuidedGoal: 'Recover',
  GuidedContext: 'Workout',
  GuidedTiming: 'Today',
});

console.log('Guided commerce QA passed.');
