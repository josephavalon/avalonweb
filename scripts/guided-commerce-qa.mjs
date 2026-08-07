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
import {
  readGuidedFlow,
  startGuidedFlow,
  timestampGuidedFlow,
} from '../src/lib/guidedSession.js';

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
      assert.ok(result.recommendations.every((item) => (
        item.offering.enabled
        && item.offering.recommendable
        && !item.offering.qualificationRequired
      )));
    }
  }
}

const catalogBefore = JSON.stringify(GUIDED_OFFERINGS);
const deterministicAnswers = { goal: 'recover', context: 'workout', timing: 'today' };
const firstRanking = rankOfferings(deterministicAnswers, GUIDED_OFFERINGS);
const secondRanking = rankOfferings(deterministicAnswers, GUIDED_OFFERINGS);
assert.deepEqual(firstRanking, secondRanking, 'rankings must be deterministic');
assert.equal(JSON.stringify(GUIDED_OFFERINGS), catalogBefore, 'rankOfferings mutated offerings');
assert.deepEqual(firstRanking.recommendations[0].reasons, [
  'goal:recover',
  'context:workout',
  'timing:today',
]);

const rule = {
  primaryGoals: ['recover'], secondaryGoals: [],
  exactContexts: ['workout'], relatedContexts: [],
  timing: { today: 4 },
};
const tiedOfferings = [
  { id: 'later', name: 'Later', protocolKey: 'later', priority: 2, enabled: true, recommendable: true, rules: rule },
  { id: 'first', name: 'First', protocolKey: 'first', priority: 1, enabled: true, recommendable: true, rules: rule },
  { id: 'disabled', name: 'Disabled', protocolKey: 'disabled', priority: 0, enabled: false, recommendable: true, rules: rule },
  { id: 'gated', name: 'Gated', protocolKey: 'gated', priority: 0, enabled: true, recommendable: true, qualificationRequired: true, rules: rule },
];
const tied = rankOfferings(deterministicAnswers, tiedOfferings, 10);
assert.deepEqual(tied.recommendations.map((item) => item.therapyId), ['first', 'later']);
assert.ok(tied.recommendations.every((item) => item.score === 21), 'fixed score bands changed');

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

const sessionValues = new Map();
global.window = {
  crypto: { randomUUID: () => 'opaque-flow-id' },
  sessionStorage: {
    getItem: (key) => sessionValues.get(key) ?? null,
    setItem: (key, value) => sessionValues.set(key, value),
    removeItem: (key) => sessionValues.delete(key),
  },
};
const flow = startGuidedFlow();
timestampGuidedFlow(flow.id, 'recommendedAt', flow.startedAt + 100);
timestampGuidedFlow(flow.id, 'answers', flow.startedAt + 200);
assert.deepEqual(Object.keys(readGuidedFlow()).sort(), ['id', 'recommendedAt', 'startedAt']);
assert.equal(JSON.stringify([...sessionValues.values()]).includes('answers'), false);

console.log('Guided commerce QA passed.');
