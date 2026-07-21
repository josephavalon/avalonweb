import React, { useMemo, useState } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BatteryCharging,
  ChevronLeft,
  Check,
  Droplets,
  Heart,
  MapPin,
  MessageCircle,
  Plane,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import { useCart } from '@/context/CartContext';
import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/config/verticals';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

const GOALS = [
  { key: 'recovery', label: 'Recover', sub: 'Feel better fast', icon: Heart, protocol: 'recovery' },
  { key: 'energy', label: 'Energy', sub: 'Recharge + focus', icon: Zap, protocol: 'myers' },
  { key: 'immunity', label: 'Immunity', sub: 'Support defense', icon: ShieldCheck, protocol: 'immunity' },
  { key: 'beauty', label: 'Glow', sub: 'Skin + radiance', icon: Sparkles, protocol: 'beauty' },
  { key: 'travel', label: 'Travel', sub: 'Jet lag + hydration', icon: Plane, protocol: 'jetlag' },
];

const QUICK_ADDONS = [
  { type: 'iv', match: 'Extra Fluid' },
  { type: 'iv', match: 'Glutathione Push · 600mg' },
  { type: 'im', match: 'B12' },
  { type: 'iv', match: 'NAD+ (250mg)' },
];

const CUSTOM_GOALS = ['Recovery', 'Energy', 'Immunity', 'Glow', 'Travel', 'Performance', 'Longevity'];
const QUANTITY_OPTIONS = [1, 2, 3, 4];

function pickAddon({ type, match }) {
  const list = type === 'im' ? IM_SHOTS : IV_ADDONS;
  const addon = list.find((item) => item.label === match) || list.find((item) => item.label.includes(match));
  return addon ? { ...addon, type } : null;
}

const QUICK_ADDON_ITEMS = QUICK_ADDONS.map(pickAddon).filter(Boolean);

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function iconForSession(session) {
  const Icon = session?.icon || Droplets;
  return Icon;
}

export default function Store() {
  useSeo({
    title: 'Start a Mobile IV Visit — Avalon Vitality',
    description: 'A simple client-facing flow to choose a goal, select a mobile IV visit, or request a custom protocol.',
    path: '/store',
  });

  const navigate = useNavigate();
  const { items: cart, addItem, removeItem, clearItems, itemsTotal } = useCart();
  const [mode, setMode] = useState('guided');
  const [step, setStep] = useState('base');
  const [goalKey, setGoalKey] = useState('recovery');
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState(new Set());
  const [customGoals, setCustomGoals] = useState(new Set(['Recovery']));
  const [people, setPeople] = useState('1');
  const [quantity, setQuantity] = useState(1);
  const [customNote, setCustomNote] = useState('');

  const goal = GOALS.find((item) => item.key === goalKey) || GOALS[0];
  const recommended = useMemo(() => {
    const key = selectedProtocol || goal.protocol;
    return IV_SESSIONS.find((item) => item.key === key) || IV_SESSIONS.find((item) => item.key === 'myers') || IV_SESSIONS[0];
  }, [goal.protocol, selectedProtocol]);

  const alternatives = useMemo(() => {
    const keys = ['hydration', 'myers', 'recovery', 'immunity', 'beauty', 'nad'];
    return keys
      .map((key) => IV_SESSIONS.find((item) => item.key === key))
      .filter(Boolean)
      .filter((item) => item.key !== recommended.key)
      .slice(0, 3);
  }, [recommended.key]);

  const addonItems = QUICK_ADDON_ITEMS.filter((item) => selectedAddons.has(item.label));
  const addonTotal = addonItems.reduce((sum, item) => sum + item.price, 0);
  const basePrice = recommended.price || recommended.doses?.[0]?.price || 0;
  const total = (basePrice + addonTotal) * quantity;
  const cartVisitCount = cart
    .filter((item) => item.type === 'iv')
    .reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const cartCount = cartVisitCount || cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const customNeedsContact = people === '5+';

  const toggleAddon = (label) => {
    setSelectedAddons((current) => {
      const next = new Set(current);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const toggleCustomGoal = (label) => {
    setCustomGoals((current) => {
      const next = new Set(current);
      next.has(label) ? next.delete(label) : next.add(label);
      return next.size ? next : new Set([label]);
    });
  };

  const saveDraft = (payload) => {
    try {
      window.localStorage.setItem('avalon.clientStoreDraft', JSON.stringify({
        ...payload,
        updatedAt: new Date().toISOString(),
      }));
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[store-draft]', err);
    }
  };

  const scrollStoreTop = () => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const storeShell = document.querySelector('[data-store-scroll]');
      if (storeShell) {
        storeShell.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const resetBaseStep = () => {
    setSelectedAddons(new Set());
    setSelectedProtocol(null);
    setQuantity(1);
    setStep('base');
    scrollStoreTop();
  };

  const openAddons = () => {
    setStep('addons');
    scrollStoreTop();
  };

  const addGuidedSelection = () => {
    const orderId = `${recommended.key}-${Date.now()}`;
    addItem({
      cartKey: `${orderId}-base`,
      label: recommended.label,
      price: basePrice,
      quantity,
      type: 'iv',
    });
    addonItems.forEach((item) => {
      addItem({
        cartKey: `${orderId}-${item.type}-${item.label}`,
        label: item.type === 'im' ? `IM · ${item.label}` : item.label,
        price: item.price,
        quantity,
        type: item.type === 'im' ? 'im' : 'addon',
      });
    });
    saveDraft({
      mode: 'guided',
      goal: goal.label,
      protocol: recommended.key,
      quantity,
      addOns: addonItems.map((item) => item.label),
      total,
    });
    resetBaseStep();
  };

  const continueGuided = () => {
    if (step === 'base') {
      openAddons();
      return;
    }
    addGuidedSelection();
  };

  const continueToCheckout = () => {
    navigate('/checkout');
  };

  const continueCustom = () => {
    saveDraft({
      mode: 'custom',
      goals: Array.from(customGoals),
      people,
      note: customNote,
    });
    navigate('/book');
  };

  return (
    <div data-store-scroll className="av-page-surface h-screen overflow-y-auto text-foreground">
      <Navbar />

      <main className="mx-auto max-w-lg px-4 pb-[calc(13rem+env(safe-area-inset-bottom))] pt-24">
        <motion.header
          initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, ease: EASE }}
          className="pb-5"
        >
          <h1 className="mt-3 font-heading text-[4.1rem] uppercase leading-[0.82] tracking-tight">
            Start
          </h1>
          <p className="mt-4 max-w-sm font-body text-base leading-relaxed text-foreground/62">
            Pick a goal. We recommend the visit.
          </p>
        </motion.header>

        <div className="grid gap-2 rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.035] p-1 md:grid-cols-2">
          {[
            ['guided', 'Guided'],
            ['custom', 'Custom'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                if (key === 'guided') setStep('base');
              }}
              className={`min-h-[52px] rounded-[1rem] font-body text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                mode === key ? 'bg-foreground text-background' : 'text-foreground/55'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'guided' ? (
          <section className="mt-4 space-y-4">
            {cart.length > 0 && (
              <CartReview
                items={cart}
                total={itemsTotal}
                count={cartCount}
                onRemove={removeItem}
                onClear={clearItems}
                onCheckout={continueToCheckout}
              />
            )}

            {step === 'base' ? (
              <>
                <div className="grid grid-cols-1 gap-2">
                  {GOALS.map((item) => {
                    const Icon = item.icon;
                    const active = item.key === goalKey;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setGoalKey(item.key);
                          setSelectedProtocol(null);
                        }}
                        className={`flex min-h-[76px] items-center gap-4 rounded-[1.35rem] border px-4 text-left transition-colors ${
                          active
                            ? 'border-foreground/22 bg-foreground text-background'
                            : 'border-foreground/[0.10] bg-foreground/[0.035] text-foreground'
                        }`}
                      >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                          active ? 'border-background/12 bg-background/10' : 'border-foreground/[0.10] bg-foreground/[0.04]'
                        }`}>
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-heading text-2xl uppercase leading-none">{item.label}</span>
                          <span className={`mt-1 block font-body text-sm ${active ? 'text-background/62' : 'text-foreground/52'}`}>{item.sub}</span>
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} />}
                      </button>
                    );
                  })}
                </div>

                <VisitCard session={recommended} active label="Selected" />
                <QuantitySelector value={quantity} onChange={setQuantity} />

                <div className="rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.03] p-3">
                  <p className="mb-3 font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">More bases</p>
                  <div className="grid gap-2">
                    {alternatives.map((session) => (
                      <button
                        key={session.key}
                        type="button"
                        onClick={() => setSelectedProtocol(session.key)}
                        className="flex min-h-[58px] items-center justify-between rounded-2xl border border-foreground/[0.08] bg-background/55 px-3 text-left"
                      >
                        <span className="font-body text-sm text-foreground/72">{session.label}</span>
                        <span className="font-body text-sm text-foreground/45">{money(session.price || session.doses?.[0]?.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('base')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-foreground/[0.12] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/58"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} /> Bases
                </button>

                <div className="rounded-[1.5rem] border border-foreground/[0.12] bg-foreground/[0.045] p-4">
                  <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">Current order</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-heading text-4xl uppercase leading-none">{recommended.label}</h2>
                      <p className="mt-2 font-body text-sm text-foreground/54">{quantity} visit{quantity !== 1 ? 's' : ''} · {money(basePrice)} each</p>
                    </div>
                    <p className="shrink-0 font-heading text-3xl leading-none">{money(total)}</p>
                  </div>
                </div>

                <QuantitySelector value={quantity} onChange={setQuantity} />

                <div className="rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.03] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">Add-ons</p>
                    <p className="font-body text-xs text-foreground/45">{selectedAddons.size} selected</p>
                  </div>
                  <div className="grid gap-2">
                    {QUICK_ADDON_ITEMS.map((item) => {
                      const active = selectedAddons.has(item.label);
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => toggleAddon(item.label)}
                          className={`flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border px-3 text-left transition-colors ${
                            active ? 'border-accent/35 bg-accent/[0.10]' : 'border-foreground/[0.08] bg-background/55'
                          }`}
                        >
                          <span>
                            <span className="block font-body text-sm font-medium">{item.type === 'im' ? `IM · ${item.label}` : item.label}</span>
                            <span className="mt-0.5 block font-body text-[11px] text-foreground/42">{item.desc}</span>
                          </span>
                          <span className="shrink-0 text-right font-body text-sm font-semibold">
                            +{money(item.price)}
                            {quantity > 1 && <span className="block text-[10px] font-medium text-foreground/38">x {quantity}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addGuidedSelection}
                  className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[1.35rem] bg-foreground px-5 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-background"
                >
                  Add to cart <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </>
            )}
          </section>
        ) : (
          <section className="mt-4 space-y-4">
            <div className="rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.035] p-4">
              <h2 className="mt-3 font-heading text-4xl uppercase leading-none">Outcome</h2>
              <p className="mt-3 font-body text-sm leading-relaxed text-foreground/58">
                For groups, events, travel, or custom recovery.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.03] p-3">
              <p className="mb-3 font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">Primary goals</p>
              <div className="flex flex-wrap gap-2">
                {CUSTOM_GOALS.map((label) => {
                  const active = customGoals.has(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleCustomGoal(label)}
                      className={`min-h-[44px] rounded-full border px-4 font-body text-xs font-semibold uppercase tracking-[0.12em] ${
                        active ? 'border-foreground bg-foreground text-background' : 'border-foreground/[0.12] text-foreground/58'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.03] p-3">
              <p className="mb-3 font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">How many people?</p>
              <div className="grid gap-2 md:grid-cols-2">
                {['1', '2', '3-4', '5+'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPeople(value)}
                    className={`av-rect-card min-h-[88px] rounded-2xl border font-body text-sm font-semibold ${
                      people === value ? 'border-foreground bg-foreground text-background' : 'border-foreground/[0.10] bg-background/55 text-foreground/62'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {customNeedsContact && (
                <p className="mt-3 rounded-2xl border border-accent/20 bg-accent/[0.08] px-3 py-2 font-body text-xs leading-relaxed text-accent/85">
                  Groups over 4 need coordination.
                </p>
              )}
            </div>

            <label className="block rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.03] p-3">
              <span className="mb-3 block font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">Notes</span>
              <textarea
                value={customNote}
                onChange={(event) => setCustomNote(event.target.value)}
                rows={5}
                placeholder="Example: I want recovery after a race, better energy, and no sedating add-ons."
                className="w-full resize-none rounded-2xl border border-foreground/[0.10] bg-background/65 px-4 py-3 font-body text-base text-foreground placeholder:text-foreground/28 focus:border-accent/50 focus:outline-none"
              />
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              <a
                href="tel:+14159807708"
                className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.035] font-body text-xs font-semibold uppercase tracking-[0.16em] text-foreground/68"
              >
                <MessageCircle className="h-4 w-4" /> Call
              </a>
              <Link
                to="/launches"
                className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.035] font-body text-xs font-semibold uppercase tracking-[0.16em] text-foreground/68"
              >
                <Users className="h-4 w-4" /> Launches
              </Link>
            </div>
          </section>
        )}
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/[0.10] bg-background/94 px-4 pt-3 backdrop-blur-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.85rem)' }}
      >
        {mode === 'guided' && cart.length > 0 && (
          <div className="mx-auto mb-3 flex max-w-lg items-center gap-3 rounded-2xl border border-foreground/[0.10] bg-foreground/[0.045] p-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/58 text-foreground">
              <ShoppingBag className="h-4 w-4" strokeWidth={1.9} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground/42">{cartCount} selected</p>
              <p className="mt-0.5 truncate font-body text-xs font-semibold text-foreground">{money(itemsTotal)} in cart</p>
            </div>
            <button
              type="button"
              onClick={continueToCheckout}
              className="min-h-[42px] rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background"
            >
              Book
            </button>
          </div>
        )}
        {mode === 'guided' && (
          <div className="mx-auto mb-3 max-w-lg rounded-2xl border border-foreground/[0.10] bg-foreground/[0.035] p-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Quantity</p>
              <p className="font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/54">1-4</p>
            </div>
            <select
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              aria-label="Cart quantity"
              className="min-h-[44px] w-full rounded-xl border border-foreground/[0.12] bg-background/72 px-3 font-body text-sm font-black text-foreground outline-none"
            >
              {QUANTITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        )}
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-body text-[10px] uppercase tracking-[0.24em] text-foreground/38">
              {mode === 'guided' ? (step === 'base' ? 'Base' : 'Add-ons') : 'Custom'}
            </p>
            <p className="mt-1 truncate font-body text-sm font-semibold text-foreground">
              {mode === 'guided' ? `${recommended.label} · ${quantity} · ${money(total)}` : `${Array.from(customGoals).slice(0, 2).join(' + ')} · ${people} people`}
            </p>
          </div>
          <button
            type="button"
            onClick={mode === 'guided' ? continueGuided : continueCustom}
            className="flex min-h-[60px] min-w-[148px] items-center justify-center gap-2 rounded-[1.35rem] bg-foreground px-5 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-background"
          >
            {mode === 'guided' ? (step === 'base' ? 'Add add-ons' : 'Add to cart') : 'Continue'} <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-lg text-center font-body text-[10px] text-foreground/34">
          Confirmed after clinical review.
        </p>
      </div>
    </div>
  );
}

function QuantitySelector({ value, onChange }) {
  return (
    <div className="rounded-[1.35rem] border border-foreground/[0.10] bg-foreground/[0.03] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">Quantity</p>
        <p className="font-body text-xs text-foreground/45">1-4 visits</p>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Base quantity"
        className="min-h-[54px] w-full rounded-2xl border border-foreground/[0.12] bg-background/65 px-4 font-heading text-2xl leading-none text-foreground outline-none"
      >
        {QUANTITY_OPTIONS.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function CartReview({ items, total, count, onRemove, onClear, onCheckout }) {
  return (
    <div className="rounded-[1.35rem] border border-accent/20 bg-accent/[0.07] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/45">Cart</p>
          <p className="mt-1 font-body text-xs font-semibold text-foreground/62">{count} selected · {money(total)}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear cart"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.10] bg-background/45 text-foreground/48"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
      <div className="grid gap-2">
        {items.map((item) => {
          const quantity = Number(item.quantity) || 1;
          const lineTotal = (Number(item.price) || 0) * quantity;
          return (
            <div key={item.cartKey} className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-foreground/[0.08] bg-background/55 px-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-0.5 font-body text-[11px] text-foreground/42">{quantity > 1 ? `${money(item.price)} x ${quantity}` : item.type}</p>
              </div>
              <p className="shrink-0 font-body text-sm font-semibold">{money(lineTotal)}</p>
              <button
                type="button"
                onClick={() => onRemove(item.cartKey)}
                aria-label={`Remove ${item.label}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.08] text-foreground/42"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCheckout}
        className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-background"
      >
        Review order <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

function VisitCard({ session, label }) {
  const Icon = iconForSession(session);
  const price = session.price || session.doses?.[0]?.price || 0;

  return (
    <div className="rounded-[1.5rem] border border-foreground/[0.12] bg-foreground/[0.045] p-4 shadow-[0_18px_54px_rgba(0,0,0,0.16)]">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/[0.10] text-accent">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          {label && <p className="font-body text-[10px] uppercase tracking-[0.24em] text-foreground/38">{label}</p>}
          <h2 className="mt-2 font-heading text-4xl uppercase leading-none">{session.label}</h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-foreground/58">{session.tagline || session.desc}</p>
        </div>
        <div className="text-right">
          <p className="font-heading text-3xl leading-none">{money(price)}</p>
          <p className="mt-1 font-body text-[10px] text-foreground/36">from</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {[
          ['Mobile', MapPin],
          [session.duration || session.doses?.[0]?.duration || '45-60 min', BatteryCharging],
          ['Registered Nurse', ShieldCheck],
        ].map(([text, IconItem]) => (
          <div key={text} className="av-rect-card flex min-h-[88px] items-center gap-3 rounded-2xl border border-foreground/[0.08] bg-background/45 px-4">
            <IconItem className="h-4 w-4 shrink-0 text-foreground/42" strokeWidth={1.6} />
            <p className="font-body text-[10px] font-black uppercase tracking-[0.12em] text-foreground/58">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
