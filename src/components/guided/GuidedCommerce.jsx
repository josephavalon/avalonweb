import { useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import {
  GUIDED_CONTEXTS,
  GUIDED_GOALS,
  GUIDED_OFFERINGS,
  GUIDED_TIMINGS,
  buildGuidedStartPath,
  getGuidedContext,
  getGuidedGoal,
  getGuidedTiming,
} from '@/data/guidedCommerce';
import { ANALYTICS_EVENTS, trackConsented } from '@/lib/analytics';
import {
  readGuidedFlow,
  restoreGuidedFlow,
  startGuidedFlow,
  timestampGuidedFlow,
} from '@/lib/guidedSession';
import { rankOfferings } from '@/lib/recommendationEngine';
import { useSeo } from '@/lib/seo';

const STEPS = Object.freeze(['goal', 'context', 'timing', 'result']);

function validGuidedState(value) {
  if (!value || !STEPS.includes(value.step) || !value.id || !Number.isFinite(value.startedAt)) return false;
  if (value.step !== 'goal' && !getGuidedGoal(value.answers?.goal)) return false;
  if (['timing', 'result'].includes(value.step) && !getGuidedContext(value.answers?.goal, value.answers?.context)) return false;
  if (value.step === 'result' && (!getGuidedTiming(value.answers?.timing) || !Number.isFinite(value.resultAt))) return false;
  return true;
}

function useHeadingFocus() {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  return headingRef;
}

function Progress({ step }) {
  const index = STEPS.indexOf(step);
  const visibleIndex = Math.min(index, 2);
  return (
    <div className="guided-progress" aria-label={`Step ${visibleIndex + 1} of 3`}>
      <span>{visibleIndex + 1} / 3</span>
      <div aria-hidden="true">
        {[0, 1, 2].map((position) => <i key={position} data-active={position <= visibleIndex} />)}
      </div>
    </div>
  );
}

function SelectionScreen({ step, title, options, onSelect, onBack, onMenu }) {
  const headingRef = useHeadingFocus();
  return (
    <div className="guided-question">
      <div className="guided-question__prompt">
        <Progress step={step} />
        <h1 ref={headingRef} data-guided-heading tabIndex={-1}>{title}</h1>
      </div>
      <div className="guided-question__choices">
        <div className="guided-options">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`guided-${step}-${option.id}`}
              onClick={() => onSelect(option.id)}
            >
              <span>{option.label}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          ))}
        </div>
        <Link to="/protocols" onClick={onMenu} className="guided-menu-link">
          View therapies <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      {onBack && (
        <button type="button" onClick={onBack} className="guided-back" aria-label="Back">
          <ArrowLeft aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function reasonFor(answers) {
  const goal = getGuidedGoal(answers.goal)?.label.toLowerCase();
  const context = getGuidedContext(answers.goal, answers.context)?.label.toLowerCase();
  return `Selected for your ${goal} goal and ${context} context.`;
}

function Results({ answers, recommendations, onSelect, onBack, onMenu }) {
  const [best, ...alternatives] = recommendations;
  const headingRef = useHeadingFocus();
  return (
    <div className="guided-results">
      <button type="button" onClick={onBack} className="guided-back guided-back--result" aria-label="Back">
        <ArrowLeft aria-hidden="true" />
      </button>
      <section className="guided-best" aria-labelledby="guided-result-heading">
        <p>Best match</p>
        <h1 ref={headingRef} id="guided-result-heading" data-guided-heading tabIndex={-1}>{best.offering.name}</h1>
        <span>{reasonFor(answers)}</span>
        <button type="button" data-testid="guided-best-match" onClick={() => onSelect(best, 0)}>
          Start with {best.offering.name.replace(/\s+IV(?:\s+250mg)?$/i, '')}
          <ArrowRight aria-hidden="true" />
        </button>
      </section>

      <section className="guided-alternatives" aria-labelledby="guided-other-options">
        <p id="guided-other-options">Other options</p>
        {alternatives.map((item, index) => (
          <button
            key={item.therapyId}
            type="button"
            data-testid={`guided-alternative-${item.therapyId}`}
            onClick={() => onSelect(item, index + 1)}
          >
            <span>
              <small>Also recommended</small>
              <strong>{item.offering.name}</strong>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        ))}
        <Link to="/protocols" onClick={onMenu} className="guided-menu-link guided-menu-link--result">
          View all therapies <ArrowRight aria-hidden="true" />
        </Link>
      </section>

      <p className="guided-clinical-note">
        Based on your goals. Your care team will confirm eligibility and the appropriate service before care.
      </p>
    </div>
  );
}

export default function GuidedCommerce() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const fallbackFlowRef = useRef(null);
  if (!fallbackFlowRef.current) {
    const routeFlow = validGuidedState(location.state?.guided) ? location.state.guided : null;
    fallbackFlowRef.current = routeFlow
      ? restoreGuidedFlow(routeFlow.id, routeFlow.startedAt)
      : startGuidedFlow();
  }

  const guided = validGuidedState(location.state?.guided)
    ? location.state.guided
    : { step: 'goal', answers: {}, ...fallbackFlowRef.current };
  const { step, answers } = guided;

  useSeo({
    title: 'Help Me Choose — Avalon Vitality',
    description: 'Choose a wellness goal and explore three Avalon therapy starting points in three simple steps.',
    path: '/nurse-delivery',
    robots: 'noindex, follow',
  });

  useEffect(() => {
    if (validGuidedState(location.state?.guided)) return;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { guided: { step: 'goal', answers: {}, ...fallbackFlowRef.current } },
    });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const flow = readGuidedFlow() || fallbackFlowRef.current;
    if (flow.startedEventAt) return;
    if (trackConsented(ANALYTICS_EVENTS.GUIDED_FLOW_STARTED, {
      flow_id: flow.id,
      screen: 'goal',
      elapsed_ms: 0,
    })) {
      timestampGuidedFlow(flow.id, 'startedEventAt');
    }
  }, []);

  const recommendations = useMemo(() => (
    step === 'result'
      ? rankOfferings(answers, GUIDED_OFFERINGS).recommendations
      : []
  ), [answers, step]);

  useEffect(() => {
    if (step !== 'result' || !guided.resultAt || recommendations.length < 3) return;
    const flow = readGuidedFlow() || fallbackFlowRef.current;
    if (flow.resultViewedAt === guided.resultAt) return;
    const recommendedAt = Date.now();
    if (trackConsented(ANALYTICS_EVENTS.RECOMMENDATION_VIEWED, {
      flow_id: flow.id,
      goal: answers.goal,
      context: answers.context,
      timing: answers.timing,
      therapy_ids: recommendations.map((item) => item.therapyId),
      elapsed_ms: Math.max(0, recommendedAt - flow.startedAt),
    })) {
      timestampGuidedFlow(flow.id, 'resultViewedAt', guided.resultAt);
    }
    timestampGuidedFlow(flow.id, 'recommendedAt', recommendedAt);
  }, [answers, guided.resultAt, recommendations, step]);

  const pushStep = (nextStep, nextAnswers, extra = {}) => {
    const flow = readGuidedFlow() || fallbackFlowRef.current;
    navigate(`${location.pathname}${location.search}`, {
      state: {
        guided: {
          step: nextStep,
          answers: nextAnswers,
          id: flow.id,
          startedAt: flow.startedAt,
          ...extra,
        },
      },
    });
  };

  const selectGoal = (goal) => {
    const flow = readGuidedFlow() || fallbackFlowRef.current;
    trackConsented(ANALYTICS_EVENTS.GOAL_SELECTED, {
      flow_id: flow.id,
      screen: 'goal',
      goal,
      elapsed_ms: Math.max(0, Date.now() - flow.startedAt),
    });
    pushStep('context', { goal });
  };

  const selectContext = (context) => {
    const flow = readGuidedFlow() || fallbackFlowRef.current;
    trackConsented(ANALYTICS_EVENTS.CONTEXT_SELECTED, {
      flow_id: flow.id,
      screen: 'context',
      goal: answers.goal,
      context,
      elapsed_ms: Math.max(0, Date.now() - flow.startedAt),
    });
    pushStep('timing', { goal: answers.goal, context });
  };

  const selectTiming = (timing) => {
    const flow = readGuidedFlow() || fallbackFlowRef.current;
    const nextAnswers = { ...answers, timing };
    trackConsented(ANALYTICS_EVENTS.TIMING_SELECTED, {
      flow_id: flow.id,
      screen: 'timing',
      ...nextAnswers,
      elapsed_ms: Math.max(0, Date.now() - flow.startedAt),
    });
    pushStep('result', nextAnswers, { resultAt: Date.now() });
  };

  const openMenu = () => {
    const flow = readGuidedFlow() || fallbackFlowRef.current;
    trackConsented(ANALYTICS_EVENTS.FULL_MENU_OPENED, {
      flow_id: flow.id,
      screen: step,
      ...(answers.goal ? { goal: answers.goal } : {}),
      ...(answers.context ? { context: answers.context } : {}),
      ...(answers.timing ? { timing: answers.timing } : {}),
      elapsed_ms: Math.max(0, Date.now() - flow.startedAt),
    });
  };

  const selectRecommendation = (item, rank) => {
    const flow = readGuidedFlow() || fallbackFlowRef.current;
    const selectedAt = Date.now();
    const eventName = rank === 0
      ? ANALYTICS_EVENTS.RECOMMENDATION_SELECTED
      : ANALYTICS_EVENTS.ALTERNATIVE_SELECTED;
    trackConsented(eventName, {
      flow_id: flow.id,
      therapy_id: item.therapyId,
      rank: rank + 1,
      screen: 'result',
      ...answers,
      elapsed_ms: Math.max(0, selectedAt - flow.startedAt),
    });
    timestampGuidedFlow(flow.id, 'selectedAt', selectedAt);
    navigate(buildGuidedStartPath(item.offering), {
      state: {
        guided: {
          answers,
          flowId: flow.id,
          startedAt: flow.startedAt,
          recommendedAt: flow.recommendedAt || selectedAt,
          selectedAt,
          offeringId: item.therapyId,
          offeringName: item.offering.name,
        },
      },
    });
  };

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.16, ease: [0.22, 1, 0.36, 1] };

  return (
    <div className="nd-flow guided-commerce app-shell min-h-[100svh] bg-background text-foreground">
      <main className="guided-commerce__main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={transition}
          >
            {step === 'goal' && (
              <SelectionScreen
                step="goal"
                title="What's your goal?"
                options={GUIDED_GOALS}
                onSelect={selectGoal}
                onMenu={openMenu}
              />
            )}
            {step === 'context' && (
              <SelectionScreen
                step="context"
                title={GUIDED_CONTEXTS[answers.goal].question}
                options={GUIDED_CONTEXTS[answers.goal].options}
                onSelect={selectContext}
                onBack={() => navigate(-1)}
                onMenu={openMenu}
              />
            )}
            {step === 'timing' && (
              <SelectionScreen
                step="timing"
                title="When do you need support?"
                options={GUIDED_TIMINGS}
                onSelect={selectTiming}
                onBack={() => navigate(-1)}
                onMenu={openMenu}
              />
            )}
            {step === 'result' && recommendations.length >= 3 && (
              <Results
                answers={answers}
                recommendations={recommendations}
                onSelect={selectRecommendation}
                onBack={() => navigate(-1)}
                onMenu={openMenu}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <ConsumerFooter />
    </div>
  );
}
