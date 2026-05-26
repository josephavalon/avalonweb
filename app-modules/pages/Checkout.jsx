import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Droplets, Syringe, ArrowRight, ArrowLeft,
  Check, X, CreditCard,
  Sparkles, Loader2, RefreshCw, Calendar,
  ShieldCheck,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Navbar from '@/components/landing/Navbar';
import { COVERED_ZIPS } from '@/lib/serviceArea';
import { useSeo } from '@/lib/seo';
import { acuityTypeForCart } from '@/lib/acuityAppointmentTypes';
import { avalonErrorClass, avalonLabelClass, avalonLightFieldClass } from '@/components/ui/formStyles';
import { orchestrateOrderHandoff } from '@/lib/platformOps';
import { readBookingDraft, readLastBooking } from '@/lib/localOs';
import { getDepositAmountDollars } from '@/lib/checkoutConfig';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { CHECKOUT_EASE as EASE, CHECKOUT_STEP_ICONS as STEP_ICONS, CHECKOUT_STEPS as STEPS, CHECKOUT_TIMEZONE as TZ, formatCheckoutTimeLabel as formatTimeLabel, todayCheckoutString as todayString } from '@/data/checkoutFlow.jsx';

const DEPOSIT_DUE = getDepositAmountDollars(import.meta.env);

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
                  : <Icon className={`w-3.5 h-3.5 ${active ? 'text-foreground' : 'text-foreground/45'}`} strokeWidth={1.8} />
                }
              </div>
              <span className={`font-body text-[9px] tracking-[0.2em] uppercase hidden sm:block ${
                active ? 'text-foreground' : done ? 'text-accent' : 'text-foreground/45'
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

function CheckoutTrustConsole({ current, items, membership, appointment }) {
  const hasVisit = items.length > 0;
  const rail = [
    {
      icon: CreditCard,
      label: hasVisit ? 'Deposit' : 'Billing',
      value: hasVisit ? `$${DEPOSIT_DUE}` : (membership ? `$${membership.price}` : 'Ready'),
      active: current >= 0,
    },
    {
      icon: Calendar,
      label: 'Acuity',
      value: appointment?.acuitySlot ? 'Locked' : 'Slot',
      active: current >= 1,
    },
    {
      icon: ShieldCheck,
      label: 'GFE',
      value: 'Queued',
      active: current >= 2,
    },
    {
      icon: Sparkles,
      label: 'RN',
      value: 'Open',
      active: current >= 3,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
      className="mb-7 grid grid-cols-4 gap-2 rounded-[1.35rem] border border-accent/20 bg-accent/[0.055] p-2 shadow-[0_18px_70px_hsl(var(--accent)/0.08)] backdrop-blur-xl"
    >
      {rail.map(({ icon: Icon, label, value, active }) => (
        <div key={label} className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${
          active ? 'border-accent/24 bg-background/55' : 'border-foreground/[0.08] bg-background/30'
        }`}>
          <Icon className={`mx-auto h-3.5 w-3.5 ${active ? 'text-accent' : 'text-foreground/45'}`} strokeWidth={1.6} />
          <p className="mt-1 font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
          <p className="mt-0.5 truncate font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/72">{value}</p>
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Step 0: Review ─────────────────────────────────────────── */
function ReviewStep({ items, membership, onRemoveItem, onClearMembership, onNext }) {
  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  const hasItems = items.length > 0 || membership;

  if (!hasItems) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <h1 className="font-heading text-h1 uppercase text-foreground">Empty Cart</h1>
        <p className="mt-3 font-body text-sm leading-relaxed text-foreground/52">
          Start with a visit, then return here to confirm timing and payment.
        </p>
        <Link
          to="/book"
          className="mt-7 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-foreground px-6 font-body text-xs font-semibold uppercase tracking-[0.18em] text-background transition-opacity hover:opacity-85"
        >
          Start Booking <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
        <Link to="/protocols" className="mt-4 inline-flex min-h-10 items-center font-body text-xs uppercase tracking-[0.16em] text-foreground/45 transition-colors hover:text-foreground/70">
          Browse Protocols
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-h1 text-foreground uppercase mb-6">Review Order</h1>

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
              <button type="button" onClick={() => onRemoveItem(item.cartKey)} aria-label={`Remove ${item.label}`} className="text-foreground/45 hover:text-foreground transition-colors p-1 focus:outline-none">
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 px-1">
            <span className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40">Visit Subtotal</span>
            <span className="font-heading text-2xl text-foreground tracking-wide">${itemsTotal.toLocaleString()}</span>
          </div>
          <p className="font-body text-[10px] text-foreground/45 px-1">${DEPOSIT_DUE} deposit at confirmation. Balance after visit.</p>
        </div>
      )}

      {/* Subscription */}
      {membership && (
        <div className="space-y-2 mt-4">
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Subscription</p>
          <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-accent/20 bg-accent/[0.05]">
            <div className="p-2 rounded-xl bg-accent/10 shrink-0">
              <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs tracking-widest uppercase text-foreground">{membership.name} Subscription</p>
              <p className="font-body text-[10px] text-foreground/40 capitalize">{membership.billing} billing · {membership.ivCount} IV{membership.ivCount > 1 ? 's' : ''}/mo</p>
            </div>
            <div className="text-right">
              <span className="font-heading text-xl text-foreground tracking-wide">${membership.price.toLocaleString()}</span>
              <p className="font-body text-[10px] text-foreground/40">/{membership.billing === 'annual' ? 'yr' : 'mo'}</p>
            </div>
            <button type="button" onClick={onClearMembership} aria-label="Remove subscription from cart" className="text-foreground/45 hover:text-foreground transition-colors p-1 focus:outline-none">
              <X className="w-4 h-4" strokeWidth={1.8} />
            </button>
          </div>
          <p className="font-body text-[10px] text-foreground/45 px-1">Recurring {membership.billing} charge. Cancel anytime.</p>
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

/* ─── Step 1: Appointment scheduling ─────────────────────────── */
function AppointmentStep({ onNext, onBack, defaultValues, appointmentTypeId }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: defaultValues || {
      date: '',
      address: '',
      notes: '',
      dob: '',
      guests: '1',
      covidPositive: 'No',
      infectiousDisease: 'No',
      ivBefore: 'Yes',
      medicalConditions: 'None of the above',
      allergies: '',
      medications: '',
      emergencyContact: '',
      privacyAck: false,
      treatmentConsent: false,
      generalConsent: false,
    },
  });

  const selectedDate = watch('date');

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(defaultValues?.acuitySlot || null);
  const [nextAvailLoading, setNextAvailLoading] = useState(false);

  const fetchSlots = useCallback(async (date) => {
    if (!date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    try {
      const params = new URLSearchParams({ date, timezone: TZ });
      if (appointmentTypeId) params.set('appointmentTypeID', appointmentTypeId);
      const res = await fetch(`/api/scheduling-availability?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load availability');
      setSlots(data);
    } catch (err) {
      setSlotsError(err.message);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [appointmentTypeId]);

  // Find the next date (up to 14 days out) with at least one slot
  const findNextAvailable = useCallback(async (fromDate) => {
    setNextAvailLoading(true);
    try {
      const base = fromDate ? new Date(fromDate + 'T12:00:00') : new Date();
      for (let i = 1; i <= 14; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        const dateStr = d.toLocaleDateString('en-CA', { timeZone: TZ });
        const params = new URLSearchParams({ date: dateStr, timezone: TZ });
        if (appointmentTypeId) params.set('appointmentTypeID', appointmentTypeId);
        const res = await fetch(`/api/scheduling-availability?${params}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.length > 0) {
          setSlots(data);
          setNextAvailLoading(false);
          return dateStr;
        }
      }
    } catch (err) {
      setSlotsError('Could not find available slots. Please try again.');
      if (import.meta.env?.DEV) console.warn('[checkout-next-available]', err);
    }
    setNextAvailLoading(false);
    return null;
  }, [appointmentTypeId]);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  const fieldClass = avalonLightFieldClass;
  const labelClass = avalonLabelClass;
  const errClass = avalonErrorClass;

  const onSubmit = (data) => {
    if (!selectedSlot) return; // guard — button is disabled anyway
    onNext({ ...data, acuitySlot: selectedSlot });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <h1 className="font-heading text-h1 text-foreground uppercase mb-6">Appointment</h1>

      {/* Address */}
      <div>
        <label htmlFor="co-service-address" className={labelClass}>Service Address *</label>
        <input
          id="co-service-address"
          {...register('address', { required: 'Address required' })}
          placeholder="Street, unit, city"
          className={fieldClass}
        />
        {errors.address && <p className={errClass}>{errors.address.message}</p>}
      </div>

      {/* ZIP code — service area enforcement */}
      <div>
        <label htmlFor="co-zip-code" className={labelClass}>ZIP Code *</label>
        <input
          id="co-zip-code"
          {...register('zip', {
            required: 'ZIP code required',
            pattern: { value: /^\d{5}$/, message: 'Enter a valid 5-digit ZIP' },
            validate: (v) =>
              COVERED_ZIPS.has(v.trim())
                ? true
                : 'Sorry — that ZIP is outside our current service area. View our coverage at avalonvitality.co/service-area.',
          })}
          inputMode="numeric"
          maxLength={5}
          placeholder="94103"
          className={fieldClass}
        />
        {errors.zip && <p className={errClass}>{errors.zip.message}</p>}
      </div>

      {/* Date picker */}
      <div>
        <label htmlFor="co-appt-date" className={labelClass}>Select Date *</label>
        <input
          id="co-appt-date"
          type="date"
          {...register('date', { required: 'Date required' })}
          className={fieldClass}
          min={todayString()}
        />
        {errors.date && <p className={errClass}>{errors.date.message}</p>}
      </div>

      {/* Appointment time slot grid */}
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
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl border border-white/10 bg-white/[0.04] animate-pulse"
                    style={{ animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </div>
            )}

            {slotsError && (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 flex items-center justify-between gap-3">
                <p className="font-body text-xs text-red-400">{slotsError}</p>
                <button
                  type="button"
                  onClick={() => fetchSlots(selectedDate)}
                  className="flex items-center gap-1.5 font-body text-[10px] tracking-widest uppercase text-foreground/50 hover:text-foreground transition-colors shrink-0"
                >
                  <RefreshCw className="w-3 h-3" strokeWidth={2} /> Retry
                </button>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length === 0 && selectedDate && (
              <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-foreground/45 shrink-0" strokeWidth={1.5} />
                  <p className="font-body text-xs text-foreground/50">No availability on this date.</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const next = await findNextAvailable(selectedDate);
                    if (next) {
                      setValue('date', next);
                    }
                    setNextAvailLoading(false);
                  }}
                  disabled={nextAvailLoading}
                  className="flex items-center gap-1.5 font-body text-[10px] tracking-widest uppercase text-accent hover:text-accent/70 transition-colors shrink-0 disabled:opacity-50"
                >
                  {nextAvailLoading
                    ? <><Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} /> Searching…</>
                    : <><RefreshCw className="w-3 h-3" strokeWidth={2} /> Next Available</>
                  }
                </button>
              </div>
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
                        appointmentTypeID: appointmentTypeId || '',
                        datetime: slot.time,
                        date: selectedDate,
                        timeLabel: label,
                        timezone: TZ,
                      })}
                      className={`py-3.5 rounded-xl font-body text-[11px] tracking-wide transition-all duration-200 ${
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="co-dob" className={labelClass}>Date of Birth *</label>
          <input
            id="co-dob"
            type="date"
            {...register('dob', { required: 'Date of birth required' })}
            className={fieldClass}
          />
          {errors.dob && <p className={errClass}>{errors.dob.message}</p>}
        </div>
        <div>
          <label htmlFor="co-guests" className={labelClass}>Guests *</label>
          <select id="co-guests" {...register('guests', { required: true })} className={fieldClass}>
            {['1', '2', '3', '4', '5+'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor="co-medical-conditions" className={labelClass}>Medical Conditions *</label>
          <select id="co-medical-conditions" {...register('medicalConditions', { required: true })} className={fieldClass}>
            {[
              'None of the above',
              'Allergies',
              'Active Viral or Bacterial infection',
              'Diabetes (Type I or II)',
              'Heart Disease',
              'Kidney Problems',
              'Liver Problems',
              'Pregnancy/Breastfeeding',
              'Other symptoms or medical conditions not listed above',
            ].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['covidPositive', 'Covid last 14 days?'],
            ['infectiousDisease', 'Infectious disease?'],
            ['ivBefore', 'IV before?'],
          ].map(([name, label]) => (
            <div key={name}>
              <label htmlFor={`co-${name}`} className={labelClass}>{label}</label>
              <select id={`co-${name}`} {...register(name, { required: true })} className={fieldClass}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="co-medical-notes" className={labelClass}>Notes for your RN</label>
        <textarea
          id="co-medical-notes"
          {...register('notes')}
          rows={3}
          placeholder="Allergies, access notes, health conditions, preferences…"
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div>
        <label htmlFor="co-allergies" className={labelClass}>Allergies or Sensitivities</label>
        <textarea
          id="co-allergies"
          {...register('allergies')}
          rows={2}
          placeholder="None, or list details"
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div>
        <label htmlFor="co-medications" className={labelClass}>Medications / Supplements</label>
        <textarea
          id="co-medications"
          {...register('medications')}
          rows={2}
          placeholder="None, or list details"
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div>
        <label htmlFor="co-emergency-contact" className={labelClass}>Emergency Contact *</label>
        <input
          id="co-emergency-contact"
          {...register('emergencyContact', { required: 'Emergency contact required' })}
          placeholder="Name + phone"
          className={fieldClass}
        />
        {errors.emergencyContact && <p className={errClass}>{errors.emergencyContact.message}</p>}
      </div>

      <div className="space-y-0 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <p className="font-body text-[9px] tracking-[0.25em] uppercase text-foreground/45 px-4 pt-4 pb-3">
          Acknowledgments — all required to continue
        </p>
        {[
          {
            name: 'privacyAck',
            text: 'I consent to Avalon Vitality collecting and using my health information to coordinate and deliver my requested wellness services, in accordance with applicable privacy laws and the Avalon Privacy Policy.',
          },
          {
            name: 'treatmentConsent',
            text: 'I understand that IV therapy and intramuscular injections are wellness support services, not medical treatments. Individual responses vary. Potential side effects include bruising, discomfort at the infusion site, or adverse reactions. I have disclosed all known health conditions and medications above.',
          },
          {
            name: 'generalConsent',
            text: "I have read, understand, and agree to Avalon Vitality's Terms of Service and Consent & Waiver. I confirm I am at least 18 years of age, and that the information I have provided is accurate to the best of my knowledge.",
          },
        ].map(({ name, text }, i) => (
          <label
            key={name}
            className={`flex gap-3 px-4 py-3.5 font-body text-xs leading-relaxed text-foreground/65 cursor-pointer hover:bg-white/[0.02] transition-colors ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}
          >
            <input
              type="checkbox"
              {...register(name, { required: 'Required' })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
            />
            <span>{text}</span>
          </label>
        ))}
        {(errors.privacyAck || errors.treatmentConsent || errors.generalConsent) && (
          <p className={`${errClass} px-4 pb-3`}>All three acknowledgments are required before continuing.</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} aria-label="Back to previous checkout step" className="flex items-center gap-2 px-6 py-3.5 font-body text-sm tracking-widest uppercase rounded-2xl border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors">
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
        <p className="font-body text-[10px] text-foreground/45 text-center -mt-1">Select a time slot to continue</p>
      )}
    </form>
  );
}

/* ─── Step 2: Contact ────────────────────────────────────────── */
function ContactStep({ onNext, onBack, defaultValues }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });

  const fieldClass = avalonLightFieldClass;
  const labelClass = avalonLabelClass;
  const errClass = avalonErrorClass;

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <h1 className="font-heading text-h1 text-foreground uppercase mb-6">Contact Info</h1>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="co-first-name" className={labelClass}>First Name *</label>
          <input id="co-first-name" {...register('firstName', { required: 'Required' })} placeholder="First" className={fieldClass} />
          {errors.firstName && <p className={errClass}>{errors.firstName.message}</p>}
        </div>
        <div>
          <label htmlFor="co-last-name" className={labelClass}>Last Name *</label>
          <input id="co-last-name" {...register('lastName', { required: 'Required' })} placeholder="Last" className={fieldClass} />
          {errors.lastName && <p className={errClass}>{errors.lastName.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="co-email" className={labelClass}>Email *</label>
        <input
          id="co-email"
          type="email"
          inputMode="email"
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
        <label htmlFor="co-phone" className={labelClass}>Phone *</label>
        <input
          id="co-phone"
          type="tel"
          inputMode="tel"
          {...register('phone', { required: 'Phone required' })}
          placeholder="+1 (415) 000-0000"
          className={fieldClass}
        />
        {errors.phone && <p className={errClass}>{errors.phone.message}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} aria-label="Back to previous checkout step" className="flex items-center gap-2 px-6 py-3.5 font-body text-sm tracking-widest uppercase rounded-2xl border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        </button>
        <button type="submit" className="flex-1 flex items-center justify-center gap-2.5 py-3.5 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 transition-colors">
          Continue <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}

/* ─── Step 3: Reserve ────────────────────────────────────────── */
function PaymentStep({ items, membership, contact, appointment, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const paymentMethod = 'card';
  const safeContact = contact || {};

  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  const hasMembership = !!membership;
  const hasItems = items.length > 0;
  const subscriptionDue = membership?.price || 0;
  const dueToday = (hasItems ? DEPOSIT_DUE : 0) + subscriptionDue || DEPOSIT_DUE;
  const futureBalance = Math.max(0, itemsTotal - (hasItems ? DEPOSIT_DUE : 0));
  const paymentMethods = [
    { id: 'card', label: 'Card checkout', helper: 'Secure card handoff', icon: CreditCard, status: 'Active', active: true },
  ];

  const handleCheckout = async () => {
    if (!safeContact.firstName || !safeContact.email) {
      setError('Add client contact before checkout.');
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'legacy_checkout',
        reason: 'contact_missing',
        has_membership: hasMembership,
        item_count: items.length,
      });
      return;
    }
    if (paymentMethod !== 'card') {
      setError('That payment method is not connected yet.');
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'legacy_checkout',
        reason: 'payment_method_unavailable',
        method: paymentMethod,
      });
      return;
    }
    setLoading(true);
    setError(null);
    track(ANALYTICS_EVENTS.CHECKOUT_STARTED, {
      funnel: 'legacy_checkout',
      mode: hasMembership ? 'subscription' : 'payment',
      has_membership: hasMembership,
      item_count: items.length,
      deposit_due: DEPOSIT_DUE,
    });
    try {
      // Determine mode — if there's a subscription, that goes first
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
            name: `${safeContact.firstName} ${safeContact.lastName || ''}`.trim(),
            firstName: safeContact.firstName,
            lastName: safeContact.lastName,
            email: safeContact.email,
            phone: safeContact.phone,
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
      orchestrateOrderHandoff({
        id: `CHK-${Date.now().toString().slice(-6)}`,
        service: membership ? `${membership.name} Subscription` : (items[0]?.label || 'Avalon visit'),
        plan: membership?.name,
        date: appointment?.date || 'First visit pending',
        time: appointment?.acuitySlot?.timeLabel || 'Schedule intake',
        address: appointment?.address || 'Service area pending',
        items,
        subtotal: itemsTotal,
        contact: {
          name: `${safeContact.firstName} ${safeContact.lastName || ''}`.trim(),
          firstName: safeContact.firstName,
          lastName: safeContact.lastName,
          email: safeContact.email,
          phone: safeContact.phone,
        },
        nurse: 'Unassigned',
        gfe: 'Pending',
        gfeRequired: true,
        depositAmount: DEPOSIT_DUE,
        status: membership ? 'Subscription intake' : 'Scheduling received',
        source: membership ? 'Subscription checkout' : 'Checkout',
        subscription: Boolean(membership),
        orderType: membership ? 'subscription' : 'recovery',
        productFamily: membership ? 'subscription' : 'iv',
        appointmentChannel: 'mobile',
        isNewClient: true,
        visitCount: 0,
      }, {
        source: membership ? 'subscription' : 'checkout',
        type: membership ? 'Subscription' : 'One-time visit',
        scope: membership ? 'All subscription dates' : 'Single appointment',
        depositAmount: DEPOSIT_DUE,
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      track(ANALYTICS_EVENTS.CHECKOUT_FAILED, {
        funnel: 'legacy_checkout',
        reason: err.message || 'checkout_request_failed',
        has_membership: hasMembership,
        item_count: items.length,
      });
    }
  };

  const labelClass = "font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40";

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-h1 text-foreground uppercase mb-6">Reserve</h1>

      {/* Order summary */}
      <div className="rounded-[1.35rem] border border-white/10 bg-background/62 p-4 shadow-[0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-xl space-y-3">
        <p className={labelClass}>Order Summary</p>
        {items.map((item) => (
          <div key={item.cartKey} className="flex justify-between items-center">
            <span className="font-body text-xs text-foreground tracking-wide">{item.label}</span>
            <span className="font-body text-xs text-foreground">${item.price.toLocaleString()}</span>
          </div>
        ))}
        {membership && (
          <div className="flex justify-between items-center">
            <span className="font-body text-xs text-foreground tracking-wide">{membership.name} Subscription ({membership.billing})</span>
            <span className="font-body text-xs text-foreground">${membership.price.toLocaleString()}/{membership.billing === 'annual' ? 'yr' : 'mo'}</span>
          </div>
        )}
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <span className={labelClass}>{hasItems && !hasMembership ? 'Deposit Due Today' : 'Due Today'}</span>
          <span className="font-heading text-2xl text-foreground tracking-wide">
            ${dueToday.toLocaleString()}
          </span>
        </div>
        {hasItems && futureBalance > 0 && (
          <div className="flex justify-between items-center">
            <span className={labelClass}>Balance After Visit</span>
            <span className="font-body text-xs font-semibold text-foreground/70">${futureBalance.toLocaleString()}</span>
          </div>
        )}
        {hasItems && !hasMembership && (
          <p className="font-body text-[10px] text-foreground/45">Deposit locks the slot. Balance after your visit.</p>
        )}
      </div>

      <div className="rounded-[1.35rem] border border-white/10 bg-background/62 p-4 shadow-[0_18px_70px_hsl(var(--foreground)/0.07)] backdrop-blur-xl space-y-3">
        <p className={labelClass}>Reserve Method</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            const selected = paymentMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => {}}
                disabled={!method.active}
                className={`min-h-[64px] rounded-2xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55 ${
                  selected ? 'border-accent/45 bg-accent/[0.08]' : 'border-foreground/[0.10] bg-background/[0.18] hover:border-foreground/25'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    selected ? 'border-accent/35 bg-accent/[0.12] text-accent' : 'border-foreground/[0.10] text-foreground/55'
                  }`}>
                    <Icon className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                      {method.label}
                    </span>
                    <span className="mt-0.5 block truncate font-body text-[10px] text-foreground/42">
                      {method.helper}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${
                    method.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-foreground/[0.06] text-foreground/45'
                  }`}>
                    {method.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
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
          <p className="font-body text-xs text-foreground">{safeContact.firstName || 'Missing'} {safeContact.lastName || ''}</p>
          <p className="font-body text-[10px] text-foreground/50 mt-0.5">{safeContact.email || 'Add email'}</p>
          <p className="font-body text-[10px] text-foreground/50">{safeContact.phone || 'Add phone'}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="font-body text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} aria-label="Back to previous checkout step" className="flex items-center gap-2 px-6 py-3.5 font-body text-sm tracking-widest uppercase rounded-2xl border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading || paymentMethod !== 'card'}
          className="flex-1 flex items-center justify-center gap-2.5 py-3.5 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-accent text-background hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="inline-block w-4 h-4 border-2 border-background/30 border-t-background rounded-full" />
              Redirecting…
            </span>
          ) : (
            <>
              {hasItems ? `Confirm — $${DEPOSIT_DUE} Deposit` : 'Start Subscription'} <CreditCard className="w-4 h-4" strokeWidth={2} />
            </>
          )}
        </button>
      </div>

      <p className="font-body text-[10px] text-center text-foreground/45 tracking-wide">
        Secure reserve · Acuity handoff · GFE before dispatch
      </p>
    </div>
  );
}

/* ─── Main Checkout Page ─────────────────────────────────────── */
export default function Checkout() {
  useSeo({
    title: 'Secure Checkout — Avalon Vitality',
    description: 'Complete your mobile IV therapy booking. Review your order, set your appointment time, and confirm with a $50 deposit.',
    path: '/checkout',
  });
  const { items, membership, removeItem, clearMembership } = useCart();
  const appointmentTypeId = acuityTypeForCart(items, membership);
  const [prefill] = useState(() => {
    const draft = readBookingDraft();
    const lastBooking = readLastBooking();
    const sourceAppointment = draft?.appointment || lastBooking || {};
    const sourceContact = draft?.contact || lastBooking?.contact || {};
    return {
      appointment: sourceAppointment.address || sourceAppointment.zip || sourceAppointment.date ? {
        address: sourceAppointment.address || '',
        zip: sourceAppointment.zip || '',
        date: sourceAppointment.date || '',
        notes: sourceAppointment.notes || '',
      } : null,
      contact: sourceContact.email || sourceContact.phone || sourceContact.name ? {
        firstName: sourceContact.firstName || String(sourceContact.name || '').trim().split(/\s+/)[0] || '',
        lastName: sourceContact.lastName || String(sourceContact.name || '').trim().split(/\s+/).slice(1).join(' '),
        email: sourceContact.email || '',
        phone: sourceContact.phone || '',
      } : null,
    };
  });
  const [step, setStep] = useState(0);
  const [appointment, setAppointment] = useState(prefill.appointment);
  const [contact, setContact] = useState(prefill.contact || {});

  const variants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
  };
  const [dir, setDir] = useState(1);

  const goTo = (next) => {
    track(ANALYTICS_EVENTS.STEP_COMPLETED, {
      funnel: 'legacy_checkout',
      step_index: step,
      step_name: STEPS[step],
      next_step_index: next,
    });
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  useEffect(() => {
    track(ANALYTICS_EVENTS.STEP_VIEWED, {
      funnel: 'legacy_checkout',
      step_index: step,
      step_name: STEPS[step],
      has_membership: Boolean(membership),
      item_count: items.length,
    });
  }, [step, membership, items.length]);

  // Skip appointment step if only subscription
  const hasOnlyMembership = membership && items.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-28 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="rounded-[1.75rem] border border-foreground/[0.12] bg-background/68 p-3 shadow-[0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl sm:p-5"
        >
          <StepBar current={step} />
          <CheckoutTrustConsole current={step} items={items} membership={membership} appointment={appointment} />

          <div className="px-1 sm:px-2">
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
                    appointmentTypeId={appointmentTypeId}
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
        </motion.div>
      </div>
    </div>
  );
}
