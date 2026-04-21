import React, { useState } from 'react';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const GOALS = [
  'Energy & Performance',
  'Anti-Aging & Longevity',
  'Recovery & Repair',
  'Mental Clarity & Focus',
  'Immune Support',
  'Stress & Sleep',
  'Weight Management',
  'General Wellness',
];

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

const MEMBERSHIP_CATEGORIES = [
  {
    category: 'FLUID',
    tiers: [
      { id: 'fluid-core', name: 'Core', price: '$120/mo' },
      { id: 'fluid-pro', name: 'Pro', price: '$240/mo' },
      { id: 'fluid-vital', name: 'Vital', price: '$360/mo' },
      { id: 'fluid-max', name: 'Max', price: '$480/mo' },
    ]
  },
  {
    category: 'VITAMINS',
    tiers: [
      { id: 'vitamins-core', name: 'Core', price: '$200/mo' },
      { id: 'vitamins-pro', name: 'Pro', price: '$400/mo' },
      { id: 'vitamins-vital', name: 'Vital', price: '$600/mo' },
      { id: 'vitamins-max', name: 'Max', price: '$800/mo' },
    ]
  },
  {
    category: 'NAD+',
    tiers: [
      { id: 'nad-core', name: 'Core', price: '$240/mo' },
      { id: 'nad-pro', name: 'Pro', price: '$440/mo' },
      { id: 'nad-vital', name: 'Vital', price: '$580/mo' },
      { id: 'nad-max', name: 'Max', price: '$720/mo' },
    ]
  },
  {
    category: 'CBD',
    tiers: [
      { id: 'cbd-core', name: 'Core', price: '$120/mo' },
      { id: 'cbd-pro', name: 'Pro', price: '$160/mo' },
      { id: 'cbd-vital', name: 'Vital', price: '$200/mo' },
      { id: 'cbd-max', name: 'Max', price: '$240/mo' },
    ]
  },
  {
    category: 'EXOSOMES',
    tiers: [
      { id: 'exo-core', name: 'Core (30B)', price: '$560/mo' },
      { id: 'exo-pro', name: 'Pro (50B)', price: '$960/mo' },
      { id: 'exo-vital', name: 'Vital (90B)', price: '$1440/mo' },
    ]
  },
  {
    category: 'VITAL ICE SF',
    tiers: [
      { id: 'vital-ice-essential-comm', name: 'Essential — Community', price: '$300/mo' },
      { id: 'vital-ice-essential-priv', name: 'Essential — Private', price: '$360/mo' },
      { id: 'vital-ice-plus-comm', name: 'Plus — Community', price: '$480/mo' },
      { id: 'vital-ice-plus-priv', name: 'Plus — Private', price: '$576/mo' },
    ]
  },
];

export default function Apply() {
  const [showPassword, setShowPassword] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', state: '', notes: '',
  });

  const toggleGoal = (goal) => {
    setSelectedGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Submission logic placeholder
  };

  const inputClass = "w-full bg-transparent border border-white/15 rounded-full px-6 py-4 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/35 transition-colors";

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="py-12 md:py-16 px-4 md:px-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-heading text-6xl md:text-[8rem] text-foreground tracking-wide mb-3">
            APPLY FOR MEMBERSHIP
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            Start your personalized wellness journey with Avalon Vitality.
          </p>
        </motion.div>
      </section>

      {/* Form Section */}
      <section className="py-8 md:py-12 px-4 md:px-16">
        <div className="max-w-2xl mx-auto">

          <form onSubmit={handleSubmit} className="w-full space-y-3">

        {/* Name row */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="First name"
            value={form.firstName}
            onChange={e => setForm({ ...form, firstName: e.target.value })}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Last name"
            value={form.lastName}
            onChange={e => setForm({ ...form, lastName: e.target.value })}
            className={inputClass}
          />
        </div>

        {/* Email */}
        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          className={inputClass}
        />

        {/* Password */}
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password (minimum 8 characters)"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* State select */}
        <div className="relative">
          <select
            value={form.state}
            onChange={e => setForm({ ...form, state: e.target.value })}
            className={`${inputClass} appearance-none pr-10 cursor-pointer`}
            style={{ background: 'transparent' }}
          >
            <option value="" disabled className="bg-[#1a0a0a]">Select your state</option>
            {US_STATES.map(s => (
              <option key={s} value={s} className="bg-[#1a0a0a]">{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Wellness goals multi-select */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setGoalsOpen(!goalsOpen)}
            className={`${inputClass} flex items-center justify-between text-left`}
          >
            <span className={selectedGoals.length ? 'text-foreground' : 'text-muted-foreground/50'}>
              {selectedGoals.length
                ? selectedGoals.join(', ')
                : 'Select your wellness goals (choose all that apply)'}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform ${goalsOpen ? 'rotate-180' : ''}`} />
          </button>

          {goalsOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[#2a0f0f] border border-white/15 rounded-2xl p-2 z-20">
              {GOALS.map(goal => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => toggleGoal(goal)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl font-body text-sm transition-colors ${
                    selectedGoals.includes(goal)
                      ? 'bg-white/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes textarea */}
        <textarea
          placeholder="Tell us about your health and wellness goals..."
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={4}
          className="w-full bg-transparent border border-white/15 rounded-2xl px-6 py-4 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/35 transition-colors resize-none"
        />

            {/* Membership tier selection */}
            <div className="pt-2">
              <p className="font-body text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-4 px-1">Select a membership tier</p>
              <div className="space-y-4">
                {MEMBERSHIP_CATEGORIES.map(category => (
                  <div key={category.category}>
                    <p className="font-body text-[9px] tracking-[0.2em] text-accent uppercase mb-2 px-1">{category.category}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {category.tiers.map(tier => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setSelectedMembership(tier.id)}
                          className={`border rounded-2xl px-4 py-3 font-body text-xs transition-all ${
                            selectedMembership === tier.id
                              ? 'border-white/40 bg-white/10 text-foreground'
                              : 'border-white/15 text-muted-foreground hover:border-white/40 hover:text-foreground'
                          }`}
                        >
                          <div className="font-semibold">{tier.name}</div>
                          <div className="text-[9px] text-muted-foreground/70">{tier.price}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full py-4 hover:bg-foreground/90 transition-colors mt-2"
            >
              Submit Application
            </button>

            <p className="text-center font-body text-xs text-muted-foreground/50 pt-1">
              Membership by application only. You'll be contacted within 48 hours.
            </p>
          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
}