import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/useAuthStore';
import {
  acknowledgeCommunicationAlert,
  buildAppointmentCommsTimeline,
  buildCommunicationSnapshot,
  createAnnouncement,
  evaluateCommsEscalations,
  markAnnouncementRead,
  readBroadcastTemplates,
  readCommunicationChannels,
  readRoleCommunications,
  resolveCommunicationAlert,
  runCommsEscalationSweep,
  sendBroadcastMessage,
  sendOpsMessage,
  sendSupportMessage,
} from '@/lib/platformOps';

const COMM_KEYS = new Set([
  'communicationAlerts',
  'announcements',
  'opsMessages',
  'supportThread',
  'assignmentBroadcasts',
  'gfeRoutingQueue',
  'shiftReplies',
  'acuityCloseoutPackets',
  'clinicalIncidents',
]);

function resolveRole(user) {
  return user?.role || 'client';
}

function resolveUserId(user) {
  return user?.id || user?.email || user?.name || 'local-user';
}

export function useCommunicationCenter({ roleOverride = null } = {}) {
  const { user } = useAuthStore();
  const role = roleOverride || resolveRole(user);
  const userId = resolveUserId(user);

  const readState = useCallback(() => ({
    ...readRoleCommunications({ role, userId }),
    snapshot: buildCommunicationSnapshot({ role, userId }),
    channels: readCommunicationChannels(),
    templates: readBroadcastTemplates(),
    timeline: buildAppointmentCommsTimeline(),
    escalations: evaluateCommsEscalations(),
  }), [role, userId]);

  const [state, setState] = useState(readState);

  const refresh = useCallback(() => {
    setState(readState());
  }, [readState]);

  useEffect(() => {
    refresh();
    const sync = (event) => {
      if (!event.detail || COMM_KEYS.has(event.detail.key)) refresh();
    };
    window.addEventListener('av.local.change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('av.local.change', sync);
      window.removeEventListener('storage', sync);
    };
  }, [refresh]);

  const actions = useMemo(() => ({
    acknowledgeAlert: (id) => {
      acknowledgeCommunicationAlert(id, user?.name || role);
      refresh();
    },
    resolveAlert: (id) => {
      resolveCommunicationAlert(id, user?.name || role);
      refresh();
    },
    publishAnnouncement: (payload) => {
      createAnnouncement({ ...payload, createdBy: user?.name || 'Avalon OS' });
      refresh();
    },
    markRead: (id) => {
      markAnnouncementRead(id, userId);
      refresh();
    },
    sendMessage: (text, options = {}) => {
      if (role === 'client' && !options.threadId) {
        sendSupportMessage(text, 'client');
      } else {
        sendOpsMessage({
          threadId: options.threadId || 'dispatch',
          audience: options.audience || (role === 'provider' ? 'Dispatch' : 'Operations'),
          from: user?.name || (role === 'provider' ? 'Nurse' : 'Avalon OS'),
          role: options.messageRole || (role === 'provider' ? 'nurse' : role),
          channels: options.channels || ['in_app'],
          text,
        });
      }
      refresh();
    },
    sendBroadcast: (payload = {}) => {
      sendBroadcastMessage(payload);
      refresh();
    },
    runEscalations: () => {
      const result = runCommsEscalationSweep();
      refresh();
      return result;
    },
  }), [refresh, role, user?.name, userId]);

  return {
    user,
    role,
    userId,
    alerts: state.alerts || [],
    announcements: state.announcements || [],
    opsMessages: state.opsMessages || [],
    supportThread: state.supportThread || [],
    channels: state.channels || [],
    templates: state.templates || [],
    timeline: state.timeline || [],
    escalations: state.escalations || [],
    snapshot: state.snapshot || buildCommunicationSnapshot({ role, userId }),
    refresh,
    ...actions,
  };
}
