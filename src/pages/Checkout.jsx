import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Droplets, Syringe, ArrowRight, ArrowLeft,
  Check, X, MapPin, Calendar, User, CreditCard,
  Sparkles, Circle, CircleDot, Clock, Loader2,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const EASE = [0.16, 1, 0.3, 1];

const STEPS = ['Review', 'Appointment', 'Contact', 'Payment'];
const STEP_ICONS = [Check, MapPin, User, CreditCard];

/* ─── Step indicator ─────────────────────────────────────────── */
function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-10 md:mb-14 max-w-md mx-auto w-full">
      {STEPS.map((label, i) => {
        const Icon = STEP_ICONS[i];
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-400 ${
                done ? 'bg-accent border-accent' :
                active ? 'border-foreground bg-foreground/10' :
                'border-foreground/20 bg-transparent'
              }`}>
                {done
                  ? <Check className="w-3.5 h-3.5 text-background" strokeWidth={2.5} />
                  : <Icon className={`w-3.5 h-3.5 ${active ? 'text-foreground' : 'text-foreground/30'}`} strokeWidth={1.8} />
                }
              </div>
              <span className={`font-body text-[9px] tracking-[0.2em] uppercase hidden sm:block ${
                active ? 'text-foreground' : done ? 'text-accent' : 'text-foreground/30'
              }`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 transition-colors duration-400 ${
                i < current ? 'bg-accent' : 'bg-foreground/15'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── Step 0: Review ─────────────────────────────────────────── */
function ReviewStep({ items, membership, onRemoveItem, onClearMembership, onNext }) {
  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  const hasItems = items.length > 0 || membership;

  if (!hasItems) {
    return (
      <div className="text-center py-16">
        <p className="font-body text-foreground/40 text-sm tracking-widest uppercase mb-6">Your cart is empty</p>
        <Link to="/#treatments" className="font-body text-xs tracking-widest uppercase text-accent hover:text-accent/70 transition-colors">
          ← Browse Treatments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-3xl md:text-5xl text-foreground tracking-wide uppercase mb-6">Review Order</h2>

      {/* One-time items */}
      {items.length > 0 && (
        <div className="space-y-2">
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">One-Time Visit</p>
          {items.map((item) => (
            <div key={item.cartKey} className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="p-2 rounded-xl bg-accent/10 shrink-0">
                {item.type === 'im'
                  ? <Syringe className="w-4 h-4 text-accent" strokeWidth={1.5} />
                  : <Droplets className="w-4 h-4 text-accent" strokeWidth={1.5} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs tracking-widest uppercase text-foreground truncate">{item.label}</p>
                <p className="font-body text-[10px] text-foreground/40">{item.type === 'iv' ? '/ session' : 'per shot'}</p>
              </div>
              <span className="font-heading text-xl text-foreground tracking-wide">${item.price.toLocaleString()}</span>
              <button type="button" onClick={() => onRemoveItem(item.cartKey)} className="text-foreground/30 hover:text-foreground transition-colors p-1 focus:outline-none">
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 px-1">
            <span className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40">Visit Subtotal</span>
            <span className="font-heading text-2xl text-foreground tracking-wide">${itemsTotal.toLocaleString()}</span>
          </div>
          <p className="font-body text-[10px] text-foreground/30 px-1">Card authorized now, charged after your appointment.</p>
        </div>
      )}

      {/* Membership */}
      {membership && (
        <div className="space-y-2 mt-4">
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Membership</p>
          <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-accent/20 bg-accent/[0.05]">
            <div className="p-2 rounded-xl bg-accent/10 shrink-0">
              <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs tracking-widest uppercase text-foreground">{membership.name} Membership</p>
              <p className="font-body text-[10px] text-foreground/40 capitalize">{membership.billing} billing · {membership.ivCount} IV{membership.ivCount > 1 ? 's' : ''}/mo</p>
            </div>
            <div className="text-right">
              <span className="font-heading text-xl text-foreground tracking-wide">${membership.price.toLocaleString()}</span>
              <p className="font-body text-[10px] text-foreground/40">/{membership.billing === 'annual' ? 'yr' : 'mo'}</p>
            </div>
            <button type="button" onClick={onClearMembership} className="text-foreground/30 hover:text-foreground transition-colors p-1 focus:outline-none">
              <X className="w-4 h-4" strokeWidth={1.8} />
            </button>
          </div>
          <p className="font-body text-[10px] text-foreground/30 px-1">Recurring {membership.billing} charge. Cancel anytime.</p>
        </div>
      )}

      <div className="pt-4">
        <button
          type="button"
          onClick={onNext}
          className="flex items-center justify-center gap-2.5 w-full py-4 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          Continue <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* ─── Step 1: Appointment (Acuity-powered) ───────────────────── */
const ACUITY_TYPE_ID = import.meta.env.VITE_ACUITY_DEFAULT_TYPE_ID || '';
const TZ = 'America/Los_Angeles';

function formatTimeLabel(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
}

function todayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}

function AppointmentStep({ onNext, onBack, defaultValues }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: defaultValues || { date: '', address: '', notes: '' },
  });

  const selectedDate = watch('date');

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(defaultValues?.acuitySlot || null);

  const fetchSlots = useCallback(async (date) => {
    if (!date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    try {
      const params = new URLSearchParams({
        date,
        appointmentTypeID: ACUITY_TYPE_ID || '0',
        timezone: TZ,
      });
      const res = await fetch(`/api/acuity-availability?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load availability');
      setSlots(data);
    } catch (err) {
      setSlotsError(err.message);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  const fieldClass = "w-full bg-white/[0.04] border border-white/15 text-foreground font-body text-sm rounded-2xl px-4 py-3.5 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors";
  const labelClass = "font-body text-[10px] tracking-[0.25em] uppercase text-foreground/50 mb-2 block";
  const errClass = "font-body text-[10px] text-red-400 mt-1";

  const onSubmit = (data) => {
    if (!selectedSlot) return; // guard — button is disabled anyway
    onNext({ ...data, acuitySlot: selectedSlot });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <h2 className="font-heading text-3xl md:text-5xl text-foreground tracking-wide uppercase mb-6">Appointment</h2>

      {/* Address */}
      <div>
        <label className={labelClass}>Service Address *</label>
        <input
          {...register('address', { required: 'Address required' })}
          placeholder="Home, office, hotel — wherever you are"
          className={fieldClass}
        />
        {errors.address && <p className={errClass}>{errors.address.message}</p>}
      </div>

      {/* Date picker */}
      <div>
        <label className={labelClass}>Select Date *</label>
        <input
          type="date"
          {...register('date', { required: 'Date required' })}
          className={fieldClass}
          min={todayString()}
        />
        {errors.date && <p className={errClass}>{errors.date.message}</p>}
      </div>

      {/* Acuity time slot grid */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <label className={labelClass}>Available Times</label>

            {slotsLoading && (
              <div className="flex items-center gap-2 py-4 text-foreground/40">
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                <span className="font-body text-xs tracking-widest uppercase">Loading availability…</span>
              </div>
            )}

            {slotsError && (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3">
                <p className="font-body text-xs text-red-400">{slotsError}</p>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length === 0 && selectedDate && (
              <p className="font-body text-xs text-foreground/40 py-3">No availability on this date. Try another day.</p>
            )}

            {!slotsLoading && slots.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => {
                  const label = formatTimeLabel(slot.time);
                  const active = selectedSlot?.datetime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedSlot({
                        appointmentTypeID: ACUITY_TYPE_ID,
                        datetime: slot.time,
                        date: selectedDate,
                        timeLabel: label,
                        timezone: TZ,
                      })}
                      className={`py-2.5 rounded-xl font-body text-[11px] tracking-wide transition-all duration-200 ${
                        active
                          ? 'bg-accent text-background shadow-[0_0_10px_-2px_hsl(var(--accent)/0.5)]'
                          : 'border border-white/15 text-foreground/70 hover:border-accent/50 hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes for your RN</label>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Allergies, access notes, health conditions, preferences…"
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex items-center gap-2 px-6 py-3.5 font-body text-sm tracking-widest uppercase rounded-2xl border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="submit"
          disabled={!selectedSlot}
          className="flex-1 flex items-center justify-center gap-2.5 py-3.5 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continue <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {!selectedSlot && selectedDate && slots.length > 0 && (
        <p className="font-body text-[10px] text-foreground/35 text-center -mt-1">Select a time slot to continue</p>
      )}
    </form>
  );
}

/* ─── Step 2: Contact ────────────────────────────────────────── */
function ContactStep({ onNext, onBack, defaultValues }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });

  const fieldClass = "w-full bg-white/[0.04] border border-white/15 text-foreground font-body text-sm rounded-2xl px-4 py-3.5 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors";
  const labelClass = "font-body text-[10px] tracking-[0.25em] uppercase text-foreground/50 mb-2 block";
  const errClass = "font-body text-[10px] text-red-400 mt-1";

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <h2 className="font-heading text-3xl md:text-5xl text-foreground tracking-wide uppercase mb-6">Contact Info</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>First Name *</label>
          <input {...register('firstName', { required: 'Required' })} placeholder="First" className={fieldClass} />
          {errors.firstName && <p className={errClass}>{errors.firstName.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Last Name *</label>
          <input {...register('lastName', { required: 'Required' })} placeholder="Last" className={fieldClass} />
          {errors.lastName && <p className={errClass}>{errors.lastName.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelClass}>Email *</label>
        <input
          type="email"
          {...register('email', {
            required: 'Email required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Valid email required' }
          })}
          placeholder="you@example.com"
          className={fieldClass}
        />
        {errors.email && <p className={errClass}>{errors.email.message}</p>}
      </div>

      <div>
        <label className={labelClass}>Phone *</label>
        <input
          type="tel"
          {...register('phone', { required: 'Phone required' })}
          placeholder="+1 (415) 000-0000"
          className={fieldClass}
        />
        {errors.phone && <p className={errClass}>{errors.phone.message}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex items-center gap-2 px-6 py-3.5 font-body text-sm tracking-widest uppercase rounded-2xl border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        </button>
        <button type="submit" className="flex-1 flex items-center justify-center gap-2.5 py-3.5 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 transition-colors">
          Continue <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}

/* ─── Step 3: Payment ────────────────────────────────────────── */
function PaymentStep({ items, membership, contact, appointment, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  const hasMembership = !!membership;
  const hasItems = items.length > 0;

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      // Determine mode — if there's a membership, that goes first
      // (one-time items can be a separate session or combined)
      const mode = hasMembership ? 'subscription' : 'payment';

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          items: hasItems ? items : [],
          membership: hasMembership ? membership : null,
          contact: {
            name: `${contact.firstName} ${contact.lastName}`,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
          },
          appointment: appointment
            ? {
                address: appointment.address,
                notes: appointment.notes,
                acuityTypeId: appointment.acuitySlot?.appointmentTypeID || '',
                acuityDatetime: appointment.acuitySlot?.datetime || '',
                acuityTimezone: appointment.acuitySlot?.timezone || 'America/Los_Angeles',
                timeLabel: appointment.acuitySlot?.timeLabel || '',
              }
            : {},
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const labelClass = "font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40";

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-3xl md:text-5xl text-foreground tracking-wide uppercase mb-6">Payment</h2>

      {/* Order summary */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <p className={labelClass}>Order Summary</p>
        {items.map((item) => (
          <div key={item.cartKey} className="flex justify-between items-center">
            <span className="font-body text-xs text-foreground tracking-wide">{item.label}</span>
            <span className="font-body text-xs text-foreground">${item.price.toLocaleString()}</span>
          </div>
        ))}
        {membership && (
          <div className="flex justify-between items-center">
            <span className="font-body text-xs text-foreground tracking-wide">{membership.name} Membership ({membership.billing})</span>
            <span className="font-body text-xs text-foreground">${membership.price.toLocaleString()}/{membership.billing === 'annual' ? 'yr' : 'mo'}</span>
          </div>
        )}
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <span className={labelClass}>Total Due Today</span>
          <span className="font-heading text-2xl text-foreground tracking-wide">
            ${(itemsTotal + (membership?.price || 0)).toLocaleString()}
          </span>
        </div>
        {hasItems && !hasMembership && (
          <p className="font-body text-[10px] text-foreground/30">Card authorized now. Charged after your visit is completed.</p>
        )}
      </div>

      {/* Appointment + contact recap */}
      <div className="grid grid-cols-2 gap-3">
        {appointment?.address && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <p className={`${labelClass} mb-1`}>Appointment</p>
            <p className="font-body text-xs text-foreground">{appointment.address}</p>
            {appointment.acuitySlot && (
              <p className="font-body text-[10px] text-foreground/50 mt-1">
                {appointment.date} · {appointment.acuitySlot.timeLabel}
              </p>
            )}
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <p className={`${labelClass} mb-1`}>Contact</p>
          <p className="font-body text-xs text-foreground">{contact.firstName} {contact.lastName}</p>
          <p className="font-body text-[10px] text-foreground/50 mt-0.5">{contact.email}</p>
          <p className="font-body text-[10px] text-foreground/50">{contact.phone}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="font-body text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex items-center gap-2 px-6 py-3.5 font-body text-sm tracking-widest uppercase rounded-2xl border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2.5 py-3.5 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-accent text-background hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full" />
              Redirecting…
            </span>
          ) : (
            <>
              Pay with Stripe <CreditCard className="w-4 h-4" strokeWidth={2} />
            </>
          )}
        </button>
      </div>

      <p className="font-body text-[10px] text-center text-foreground/25 tracking-wide">
        Secured by Stripe · 256-bit SSL encryption · Apple Pay & Google Pay accepted
      </p>
    </div>
  );
}

/* ─── Main Checkout Page ─────────────────────────────────────── */
export default function Checkout() {
  const { items, membership, removeItem, clearMembership } = useCart();
  const [step, setStep] = useState(0);
  const [appointment, setAppointment] = useState(null);
  const [contact, setContact] = useState(null);
  const navigate = useNavigate();

  const variants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
  };
  const [dir, setDir] = useState(1);

  const goTo = (next) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  // Skip appointment step if only membership
  const hasOnlyMembership = membership && items.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-28 pb-20">
        <StepBar current={step} />

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
          >
            {step === 0 && (
              <ReviewStep
                items={items}
                membership={membership}
                onRemoveItem={removeItem}
                onClearMembership={clearMembership}
                onNext={() => goTo(hasOnlyMembership ? 2 : 1)}
              />
            )}
            {step === 1 && !hasOnlyMembership && (
              <AppointmentStep
                defaultValues={appointment}
                onNext={(data) => { setAppointment(data); goTo(2); }}
                onBack={() => goTo(0)}
              />
            )}
            {step === 2 && (
              <ContactStep
                defaultValues={contact}
                onNext={(data) => { setContact(data); goTo(3); }}
                onBack={() => goTo(hasOnlyMembership ? 0 : 1)}
              />
            )}
            {step === 3 && (
              <PaymentStep
                items={items}
                membership={membership}
                contact={contact}
                appointment={appointment}
                onBack={() => goTo(2)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
