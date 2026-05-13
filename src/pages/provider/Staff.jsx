import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, User, Phone, MessageSquare, Shield, Package,
  CheckCircle, MapPin, Clock, X, Star, Zap,
  ChevronRight, AlertTriangle,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { REQUESTS, NURSES } from '@/data/commandMockData';

// ── Constants ─────────────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1];

const STATUS_MAP = {
  'Available':      { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.25)'  },
  'Assigned':       { bg: 'rgba(45,212,191,0.12)',  color: '#2dd4bf', border: 'rgba(45,212,191,0.25)'  },
  'Off Duty':       { bg: 'rgba(148,163,184,0.10)', color: '#94a3b8', border: 'rgba(148,163,184,0.20)' },
  'Pending':        { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.25)'  },
  'Ready':          { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.25)'  },
  'Restock Needed': { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.25)'   },
  'Low Stock':      { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.25)'  },
  'Check Expiry':   { bg: 'rgba(249,115,22,0.12)',  color: '#f97316', border: 'rgba(249,115,22,0.25)'  },
  'Clear':          { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.25)'  },
  'Review':         { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.25)'  },
  'Expiring Soon':  { bg: 'rgba(249,115,22,0.12)',  color: '#f97316', border: 'rgba(249,115,22,0.25)'  },
};

function getStatusStyle(status) {
  return STATUS_MAP[status] || { bg: 'rgba(148,163,184,0.10)', color: '#94a3b8', border: 'rgba(148,163,184,0.20)' };
}

// ── StatusPill ────────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const s = getStatusStyle(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.18em] uppercase font-medium px-2.5 py-1 rounded-full border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'currentColor' }} />
      {status}
    </span>
  );
}

// ── AssignModal ───────────────────────────────────────────────────────────────

function AssignModal({ nurse, requests, onAssign, onClose }) {
  const eligible = requests.filter(
    r => !r.nurse && r.status !== 'Completed' && r.status !== 'Cancelled'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="relative w-full max-w-lg rounded-2xl border z-10 overflow-hidden"
        style={{ background: '#111114', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase mb-0.5" style={{ color: '#c9a84c' }}>
              Assign Request
            </p>
            <h3 className="font-heading text-xl tracking-widest text-white">
              {nurse.name.toUpperCase()}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <X className="w-4 h-4 text-white" strokeWidth={1.5} />
          </button>
        </div>

        {/* Request list */}
        <div className="px-6 py-5 max-h-96 overflow-y-auto">
          {eligible.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-8 h-8 mx-auto mb-3" style={{ color: '#34d399' }} strokeWidth={1.5} />
              <p className="text-sm text-white opacity-60">No unassigned requests available.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {eligible.map(req => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                >
                  <div className="min-w-0 flex-1 mr-4">
                    <p className="text-sm font-medium text-white truncate">{req.client || req.clientName}</p>
                    <p className="text-[11px] text-white mt-0.5 truncate" style={{ color: '#c9a84c' }}>
                      {req.therapy}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} strokeWidth={1.5} />
                      <span className="text-[10px] text-white opacity-50">{req.time}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onAssign(req.id, nurse.name)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] uppercase font-semibold transition-all hover:brightness-110"
                    style={{ background: '#c9a84c', color: '#0A0A0A' }}
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── NurseCard ─────────────────────────────────────────────────────────────────

function NurseCard({ nurse, requests, onAssign, index }) {
  const [showAssignModal, setShowAssignModal] = useState(false);

  function handleAssign(requestId, nurseName) {
    onAssign(requestId, nurseName, nurse.id);
    setShowAssignModal(false);
  }

  const credStyle = getStatusStyle(nurse.credentialStatus);
  const kitStyle  = getStatusStyle(nurse.kitStatus);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: index * 0.06 }}
        className="rounded-2xl border overflow-hidden"
        style={{ background: '#111114', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {/* Header row */}
        <div
          className="px-5 py-4 border-b flex items-start justify-between gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading text-xl tracking-widest text-white uppercase truncate">
                {nurse.name}
              </h3>
              <StatusPill status={nurse.status} />
            </div>
            <div className="mt-1.5">
              <span
                className="inline-block text-[9px] tracking-[0.15em] uppercase font-medium px-2 py-0.5 rounded border"
                style={{ background: kitStyle.bg, color: kitStyle.color, borderColor: kitStyle.border }}
              >
                Kit: {nurse.kitStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Service area + visits */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#c9a84c' }} strokeWidth={1.5} />
              <span className="text-sm text-white">{nurse.serviceArea}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" style={{ color: '#c9a84c' }} strokeWidth={1.5} />
              <span className="text-[11px] text-white">
                <span style={{ color: '#c9a84c' }}>{nurse.visitsToday}</span>
                <span className="opacity-50"> visits today</span>
              </span>
            </div>
          </div>

          {/* Credentials */}
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: credStyle.color }} strokeWidth={1.5} />
            <span className="text-[12px] text-white opacity-70">Credentials:</span>
            <span
              className="text-[11px] font-medium tracking-wide"
              style={{ color: credStyle.color }}
            >
              {nurse.credentialStatus}
            </span>
          </div>

          {/* Kit status line */}
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 shrink-0" style={{ color: kitStyle.color }} strokeWidth={1.5} />
            <span className="text-[12px] text-white opacity-70">Kit:</span>
            <span
              className="text-[11px] font-medium tracking-wide"
              style={{ color: kitStyle.color }}
            >
              {nurse.kitStatus}
            </span>
          </div>

          {/* Assigned to */}
          {nurse.status === 'Assigned' && nurse.assignedTo && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 border"
              style={{ background: 'rgba(45,212,191,0.06)', borderColor: 'rgba(45,212,191,0.15)' }}
            >
              <User className="w-3.5 h-3.5 shrink-0" style={{ color: '#2dd4bf' }} strokeWidth={1.5} />
              <span className="text-[11px]" style={{ color: '#2dd4bf' }}>
                Assigned to: <span className="font-medium">{nurse.assignedTo}</span>
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className="px-5 py-3 border-t flex items-center gap-2"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] tracking-[0.1em] uppercase font-medium text-white transition-colors hover:border-white/20"
            style={{ borderColor: 'rgba(255,255,255,0.10)' }}
            title="Message nurse"
          >
            <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
            Message
          </button>

          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] uppercase font-semibold transition-all hover:brightness-110"
            style={{ background: '#c9a84c', color: '#0A0A0A' }}
          >
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            Assign
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAssignModal && (
          <AssignModal
            nurse={nurse}
            requests={requests}
            onAssign={handleAssign}
            onClose={() => setShowAssignModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function NurseSection({ label, nurses, color, requests, onAssign }) {
  if (nurses.length === 0) return null;
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <p
          className="text-[10px] tracking-[0.3em] uppercase font-semibold"
          style={{ color }}
        >
          {label}
        </p>
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold"
          style={{ background: color + '20', color }}
        >
          {nurses.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nurses.map((nurse, i) => (
          <NurseCard
            key={nurse.id}
            nurse={nurse}
            requests={requests}
            onAssign={onAssign}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Staff() {
  const [nurses, setNurses]     = useState(NURSES);
  const [requests, setRequests] = useState(REQUESTS);

  function handleAssign(requestId, nurseName, nurseId) {
    setRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, nurse: nurseName } : r)
    );
    setNurses(prev =>
      prev.map(n =>
        n.id === nurseId
          ? { ...n, status: 'Assigned', assignedTo: requests.find(r => r.id === requestId)?.client || requests.find(r => r.id === requestId)?.clientName || nurseName }
          : n
      )
    );
  }

  const available = nurses.filter(n => n.status === 'Available');
  const assigned  = nurses.filter(n => n.status === 'Assigned');
  const other     = nurses.filter(n => n.status !== 'Available' && n.status !== 'Assigned');

  const kitsReady = nurses.filter(n => n.kitStatus === 'Ready').length;
  const visitsToday = nurses.reduce((s, n) => s + (n.visitsToday || 0), 0);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">

        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mb-8"
        >
          <p className="text-[10px] tracking-[0.35em] uppercase mb-1.5 font-medium" style={{ color: '#c9a84c' }}>
            Nurse Assignment Board
          </p>
          <h1 className="font-heading text-5xl tracking-widest text-white">NURSES</h1>
          <p className="text-[13px] text-white mt-2 opacity-60">SF Bay Area · Manual Dispatch</p>

          {/* Summary pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.1em] uppercase font-medium px-3 py-1.5 rounded-full border"
              style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', borderColor: 'rgba(52,211,153,0.25)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Available: {available.length}
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.1em] uppercase font-medium px-3 py-1.5 rounded-full border"
              style={{ background: 'rgba(45,212,191,0.10)', color: '#2dd4bf', borderColor: 'rgba(45,212,191,0.25)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Assigned: {assigned.length}
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.1em] uppercase font-medium px-3 py-1.5 rounded-full border"
              style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', borderColor: 'rgba(148,163,184,0.18)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Off Duty: {other.length}
            </span>
          </div>
        </motion.div>

        {/* ── Quick Stats Bar ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.08, ease: EASE }}
          className="rounded-xl border px-5 py-3.5 mb-8 flex flex-wrap items-center gap-4"
          style={{ background: '#111114', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          {[
            { icon: Users,        label: 'Available',     value: available.length,                     color: '#34d399' },
            { icon: Zap,          label: 'Assigned',      value: assigned.length,                      color: '#2dd4bf' },
            { icon: Star,         label: 'Visits Today',  value: visitsToday,                          color: '#c9a84c' },
            { icon: Package,      label: 'Kits Ready',    value: `${kitsReady}/${nurses.length}`,      color: '#c9a84c' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 shrink-0" style={{ color }} strokeWidth={1.5} />
              <span className="text-[11px] text-white opacity-60 uppercase tracking-wider">{label}:</span>
              <span className="text-[13px] font-medium text-white" style={{ color }}>{value}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Sections ── */}
        <NurseSection
          label="Available"
          nurses={available}
          color="#34d399"
          requests={requests}
          onAssign={handleAssign}
        />
        <NurseSection
          label="Assigned Today"
          nurses={assigned}
          color="#2dd4bf"
          requests={requests}
          onAssign={handleAssign}
        />
        <NurseSection
          label="Off Duty / Pending"
          nurses={other}
          color="#94a3b8"
          requests={requests}
          onAssign={handleAssign}
        />

        {nurses.length === 0 && (
          <div className="text-center py-20">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: '#c9a84c' }} strokeWidth={1} />
            <p className="text-white opacity-50 text-sm">No nurses loaded. Check commandMockData.</p>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
