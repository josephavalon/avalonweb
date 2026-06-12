import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { Check, Plus, UserPlus, X } from 'lucide-react';
import { addQuickPatient } from '@/lib/clientIntakeStore';

const EASE = [0.16, 1, 0.3, 1];

const FIELD = 'min-h-[50px] w-full rounded-2xl border border-foreground/10 bg-background/72 px-4 font-body text-base text-foreground outline-none transition-colors placeholder:text-foreground/28 focus:border-foreground/35';
const LABEL = 'mb-2 block font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/42';

export default function QuickPatientAdd({
  context = 'ops',
  source = 'Avalon OS',
  service = 'Protocol pending',
  event = null,
  triggerLabel = 'Add Patient',
  triggerClassName = '',
  onCreated,
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    zip: '',
    service,
    note: '',
    source,
  });

  const title = event ? 'Add Event Guest' : context === 'nurse' ? 'Add Patient' : 'Add Client';
  const hint = event ? 'Name, phone, time. Pushes into the event roster.' : 'Minimum info now. Intake, GFE, and scheduling next.';

  const triggerClasses = useMemo(() => (
    triggerClassName || 'inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-foreground px-4 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98]'
  ), [triggerClassName]);

  const setValue = (key, value) => {
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setForm({
      name: '',
      phone: '',
      email: '',
      city: '',
      zip: '',
      service,
      note: '',
      source,
    });
  };

  const close = () => {
    setOpen(false);
    setError('');
    setSaved(null);
  };

  const submit = (eventSubmit) => {
    eventSubmit.preventDefault();
    if (!form.name.trim()) {
      setError('Name required.');
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError('Add phone or email.');
      return;
    }
    const patient = addQuickPatient(form, {
      portal: context,
      source,
      service: form.service,
      eventId: event?.id || '',
      eventName: event?.name || '',
    });
    setSaved(patient);
    onCreated?.(patient);
    reset();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClasses}>
        <UserPlus className="h-4 w-4" strokeWidth={1.8} />
        {triggerLabel}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="av-modal-scrim fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.form
              onSubmit={submit}
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.32, ease: EASE }}
              onClick={(eventClick) => eventClick.stopPropagation()}
              className="w-full max-w-lg rounded-[1.6rem] border border-foreground/10 bg-background/92 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/42">{context}</p>
                  <h2 className="mt-2 font-heading text-4xl uppercase leading-none text-foreground">{title}</h2>
                  <p className="mt-2 font-body text-sm leading-snug text-foreground/52">{hint}</p>
                </div>
                <button type="button" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.04]" aria-label="Close add patient">
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              {saved && (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2.5 text-emerald-200">
                  <Check className="h-4 w-4" strokeWidth={2} />
                  <p className="font-body text-xs font-semibold uppercase tracking-[0.12em]">Added. Intake and GFE next.</p>
                </div>
              )}

              <div className="grid gap-3">
                <label>
                  <span className={LABEL}>Name</span>
                  <input className={FIELD} value={form.name} onChange={(eventChange) => setValue('name', eventChange.target.value)} placeholder="Full name" autoFocus />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={LABEL}>Phone</span>
                    <input className={FIELD} inputMode="tel" value={form.phone} onChange={(eventChange) => setValue('phone', eventChange.target.value)} placeholder="Mobile" />
                  </label>
                  <label>
                    <span className={LABEL}>Email</span>
                    <input className={FIELD} type="email" value={form.email} onChange={(eventChange) => setValue('email', eventChange.target.value)} placeholder="Email" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={LABEL}>City</span>
                    <input className={FIELD} value={form.city} onChange={(eventChange) => setValue('city', eventChange.target.value)} placeholder={event?.venue || 'City'} />
                  </label>
                  <label>
                    <span className={LABEL}>ZIP</span>
                    <input className={FIELD} inputMode="numeric" value={form.zip} onChange={(eventChange) => setValue('zip', eventChange.target.value)} placeholder="94105" />
                  </label>
                </div>
                <label>
                  <span className={LABEL}>Protocol</span>
                  <input className={FIELD} value={form.service} onChange={(eventChange) => setValue('service', eventChange.target.value)} placeholder="Protocol" />
                </label>
                <label>
                  <span className={LABEL}>Note</span>
                  <textarea className={`${FIELD} min-h-[78px] py-3`} value={form.note} onChange={(eventChange) => setValue('note', eventChange.target.value)} placeholder="Optional ops note" />
                </label>
              </div>

              {error && <p className="mt-3 font-body text-xs text-red-300">{error}</p>}

              <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2">
                <button type="button" onClick={close} className="min-h-[52px] rounded-full border border-foreground/12 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/58">
                  Done
                </button>
                <button type="submit" className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-foreground font-body text-[10px] font-bold uppercase tracking-[0.16em] text-background">
                  <Plus className="h-4 w-4" strokeWidth={1.8} />
                  Add
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
