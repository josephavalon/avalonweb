import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ArrowRight, MapPin, Clock } from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { APPOINTMENTS, getClient, getService, formatTime } from '@/data/commandMockData';

// ── Design tokens — match NurseShift.jsx ─────────────────────────────────────
const BG   = '#0a0a0a';
const CARD = '#111110';
const GOLD = '#c9a84c';
const TEXT = '#F0EDE4';

const TODAY = new Date().toISOString().slice(0, 10);

function statusColor(s) {
  if (s === 'completed')   return 'rgba(255,255,255,0.5)';
  if (s === 'in_progress') return '#4ade80';
  if (s === 'confirmed')   return '#4ade80';
  return 'rgba(255,255,255,0.5)';
}

export default function NurseDashboard() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const todayAppts = APPOINTMENTS.filter(a => {
    const d = new Date(a.scheduled_at);
    return d.toISOString().slice(0, 10) === TODAY;
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen pb-24" style={{ background: BG }}>

      {/* Top bar */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5"
        style={{ background: 'rgba(10,10,10,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
      >
        <span className="font-heading text-[22px] tracking-[0.2em]" style={{ color: TEXT }}>AVALON</span>
        <button
          onClick={() => { signOut(); navigate('/login'); }}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-70"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" style={{ color: 'rgba(240,237,228,0.55)' }} strokeWidth={1.5} />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-7 space-y-6">

        {/* Greeting */}
        <div>
          <h1 className="font-heading text-4xl uppercase leading-none tracking-tight mb-1" style={{ color: TEXT }}>
            {greeting}, {user?.name || 'Nurse'}.
          </h1>
          <p className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: 'rgba(240,237,228,0.45)' }}>
            {dateLabel}
          </p>
        </div>

        {/* Today stat */}
        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: CARD, border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div>
            <p className="font-body text-[10px] tracking-[0.28em] uppercase mb-1" style={{ color: 'rgba(240,237,228,0.45)' }}>
              Visits Today
            </p>
            <span className="font-heading text-[64px] leading-none tracking-tight" style={{ color: GOLD }}>
              {todayAppts.length}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-body text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(240,237,228,0.35)' }}>
              {todayAppts.filter(a => a.status === 'completed').length} done
            </span>
            <span className="font-body text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(240,237,228,0.35)' }}>
              {todayAppts.filter(a => a.status !== 'completed').length} remaining
            </span>
          </div>
        </div>

        {/* Visit list */}
        <div>
          <p className="font-body text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(240,237,228,0.35)' }}>
            Today's Visits
          </p>
          <div className="space-y-2.5">
            {todayAppts.length === 0 && (
              <p className="font-body text-sm" style={{ color: 'rgba(240,237,228,0.45)' }}>No visits scheduled for today.</p>
            )}
            {todayAppts.map((appt, i) => {
              const client  = getClient(appt.client_id);
              const service = getService(appt.service_id);
              if (!client || !service) return null;
              const sc = statusColor(appt.status);
              return (
                <div
                  key={appt.id}
                  className="rounded-2xl p-4"
                  style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-heading text-lg uppercase leading-none tracking-tight truncate" style={{ color: TEXT }}>
                        {client.first_name} {client.last_name}
                      </p>
                      <p className="font-body text-xs mt-0.5" style={{ color: 'rgba(240,237,228,0.55)' }}>
                        {service.name}
                      </p>
                    </div>
                    <span
                      className="font-body text-[9px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: `${sc}22`, color: sc, border: `1px solid ${sc}44` }}
                    >
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1 font-body text-[11px]" style={{ color: 'rgba(240,237,228,0.5)' }}>
                      <Clock className="w-3 h-3" strokeWidth={1.5} style={{ color: 'rgba(240,237,228,0.3)' }} />
                      {formatTime(appt.scheduled_at)}
                    </span>
                    <span className="flex items-center gap-1 font-body text-[11px]" style={{ color: 'rgba(240,237,228,0.5)' }}>
                      <MapPin className="w-3 h-3" strokeWidth={1.5} style={{ color: 'rgba(240,237,228,0.3)' }} />
                      {appt.location_address}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <Link
          to="/provider/shift"
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-body text-sm tracking-[0.2em] uppercase font-semibold transition-opacity hover:opacity-80"
          style={{ background: GOLD, color: '#0a0a0a' }}
        >
          View Full Shift <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </Link>

        {/* Bottom safe area */}
        <div className="h-6" />
      </div>
    </div>
  );
}
