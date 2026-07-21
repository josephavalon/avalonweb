import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import {
  ArrowRight, ArrowLeft, Check,
  Heart, Zap, Sparkles, ShieldCheck, Plane, HelpCircle,
  Moon, Coffee, Thermometer, Droplets, Activity, Cloud,
  FlaskConical, Shield, MinusCircle,
  Calendar, Eye, Home as HomeIcon, BedDouble, Briefcase, PartyPopper,
} from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';
import GlassCard from '@/components/ui/GlassCard';

// Every answer is an icon tile. Each step is single-select; the quiz walks the
// visitor through 5 screens, then deep-links into /book with the matched drip
// preselected. Keys below are the ONLY contract with BookNow: `goal`/`feeling`
// resolve to a valid PUBLIC_BOOKING_PROTOCOL_KEY (see deriveProtocol).
const QUIZ_STEPS = [
  {
    id: 'goal',
    question: "What brings you in?",
    options: [
      { key: 'recovery', label: 'Recovery', icon: Heart },
      { key: 'energy', label: 'Energy', icon: Zap },
      { key: 'beauty', label: 'Beauty', icon: Sparkles },
      { key: 'immunity', label: 'Immunity', icon: ShieldCheck },
      { key: 'travel', label: 'Travel', icon: Plane },
      { key: 'all', label: 'Not sure', icon: HelpCircle },
    ],
  },
  {
    id: 'feeling',
    question: "How are you feeling?",
    options: [
      { key: 'tired', label: 'Tired', icon: Moon },
      { key: 'hungover', label: 'Hungover', icon: Coffee },
      { key: 'run-down', label: 'Run-down', icon: Thermometer },
      { key: 'dehydrated', label: 'Dehydrated', icon: Droplets },
      { key: 'stressed', label: 'Stressed', icon: Activity },
      { key: 'foggy', label: 'Foggy', icon: Cloud },
    ],
  },
  {
    id: 'boost',
    question: "Add a boost?",
    options: [
      { key: 'b12', label: 'B12', icon: Zap },
      { key: 'glutathione', label: 'Glutathione', icon: FlaskConical },
      { key: 'vitamin-c', label: 'Vitamin C', icon: Shield },
      { key: 'skip', label: 'Skip', icon: MinusCircle },
    ],
  },
  {
    id: 'when',
    question: "When do you need it?",
    options: [
      { key: 'today', label: 'Today', icon: Zap },
      { key: 'week', label: 'This week', icon: Calendar },
      { key: 'browsing', label: 'Just browsing', icon: Eye },
    ],
  },
  {
    id: 'where',
    question: "Where are you?",
    options: [
      { key: 'home', label: 'Home', icon: HomeIcon },
      { key: 'hotel', label: 'Hotel', icon: BedDouble },
      { key: 'office', label: 'Office', icon: Briefcase },
      { key: 'event', label: 'Event', icon: PartyPopper },
    ],
  },
];

const GOAL_TO_PROTOCOL = {
  recovery: 'recovery',
  energy: 'myers',
  beauty: 'beauty',
  immunity: 'immunity',
  travel: 'jetlag',
  all: '',
};
const FEELING_OVERRIDE = {
  hungover: 'postnight',
  dehydrated: 'hydration',
  'run-down': 'immunity',
};

function deriveProtocol(answers) {
  return FEELING_OVERRIDE[answers.feeling] || GOAL_TO_PROTOCOL[answers.goal] || '';
}

// Underlined-text CTA that reads as a link, not a shouty button. Same
// affordance the screenshot calls for on the intro pill ("FIND MY IV →").
const LINK_CTA_CLASS =
  'group inline-flex items-center gap-1.5 pb-0.5 font-body text-[11px] uppercase tracking-[0.24em] text-foreground border-b border-foreground/60 transition-colors duration-base ease-editorial hover:border-foreground hover:text-foreground/85 disabled:opacity-40 disabled:pointer-events-none';

function StepDots({ total, current }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-base ease-editorial ${
            i <= current ? 'bg-foreground' : 'bg-foreground/25'
          }`}
        />
      ))}
    </div>
  );
}

function IconTile({ option, selected, onSelect }) {
  const Icon = option.icon;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={premiumHover}
      whileTap={premiumTap}
      aria-pressed={selected}
      className={`av-treatment-card group relative flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors duration-base ease-editorial ${
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-foreground/[0.12] text-foreground hover:border-foreground/40'
      }`}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground">
          <Check className="h-3 w-3" strokeWidth={2.5} />
        </span>
      )}
      <Icon className="h-5 w-5" strokeWidth={1.6} />
      <span className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] leading-tight">
        {option.label}
      </span>
    </motion.button>
  );
}

export default function WellnessQuiz() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const isIntro = step === 0;
  const stepData = isIntro ? null : QUIZ_STEPS[step - 1];
  const isLast = step === QUIZ_STEPS.length;
  const currentAnswer = stepData ? answers[stepData.id] : null;

  const select = (key) => setAnswers((prev) => ({ ...prev, [stepData.id]: key }));

  const goNext = () => {
    if (isLast) {
      const protocol = deriveProtocol(answers);
      const params = new URLSearchParams();
      if (protocol) params.set('protocol', protocol);
      if (answers.boost && answers.boost !== 'skip') params.set('boost', answers.boost);
      if (answers.when) params.set('when', answers.when);
      if (answers.where) params.set('loc', answers.where);
      const qs = params.toString();
      navigate(qs ? `/book?${qs}` : '/book');
      return;
    }
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.32, ease: EASE };

  return (
    <section id="wellness-quiz" className="pt-10 pb-8 md:pt-14 md:pb-10 px-4 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <GlassCard tone="heavy" radius="1.55rem" className="px-5 py-5 md:px-8 md:py-6">
          <AnimatePresence mode="wait" initial={false}>
            {isIntro ? (
              <motion.div
                key="intro"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={transition}
                className="grid gap-3 md:grid-cols-[minmax(0,190px)_1fr_auto] md:items-center md:gap-0 md:divide-x md:divide-foreground/10"
              >
                {/* Left: kicker */}
                <p className="font-body text-[11px] uppercase tracking-[0.32em] text-foreground/55 md:pr-8">
                  IV Finder<sup className="ml-0.5 align-super text-[0.5em] leading-none">™</sup>
                </p>

                {/* Center: headline + body */}
                <div className="md:px-8">
                  <h2 className="font-heading text-5xl uppercase leading-none tracking-tight text-foreground md:text-[64px]">
                    Not sure?
                  </h2>
                  <p className="mt-1.5 font-body text-[11px] uppercase leading-relaxed tracking-[0.18em] text-foreground/55 md:text-xs">
                    Find the right IV in under 60 seconds
                  </p>
                </div>

                {/* Right: link CTA */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`${LINK_CTA_CLASS} justify-self-start md:justify-self-end md:pl-8`}
                >
                  Find my IV
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={stepData.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={transition}
                className="grid gap-4 md:grid-cols-[minmax(0,190px)_1fr_auto] md:items-center md:gap-0 md:divide-x md:divide-foreground/10"
              >
                {/* Left: kicker + step counter */}
                <div className="flex items-center justify-between md:block md:pr-8">
                  <p className="font-body text-[11px] uppercase tracking-[0.32em] text-foreground/55">
                    IV Finder<sup className="ml-0.5 align-super text-[0.5em] leading-none">™</sup>
                  </p>
                  <div className="flex items-center gap-2 md:mt-2">
                    <StepDots total={QUIZ_STEPS.length} current={step - 1} />
                    <span className="font-body text-[11px] tabular-nums text-foreground/45">
                      {step}/{QUIZ_STEPS.length}
                    </span>
                  </div>
                </div>

                {/* Center: question + tiles */}
                <div className="md:px-8">
                  <h2 className="font-heading text-3xl uppercase leading-none tracking-tight text-foreground md:text-4xl">
                    {stepData.question}
                  </h2>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 md:gap-2.5">
                    {stepData.options.map((option) => (
                      <IconTile
                        key={option.key}
                        option={option}
                        selected={currentAnswer === option.key}
                        onSelect={() => select(option.key)}
                      />
                    ))}
                  </div>
                </div>

                {/* Right: Back · Next */}
                <div className="flex items-center justify-between gap-4 md:flex-col md:items-stretch md:gap-3 md:pl-8">
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.24em] text-foreground/55 transition-colors duration-base ease-editorial hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!currentAnswer}
                    className={`${LINK_CTA_CLASS} md:self-end`}
                  >
                    {isLast ? 'See my drip' : 'Next'}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </section>
  );
}
