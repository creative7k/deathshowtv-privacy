import { useCallback, useEffect, useRef, useState } from 'react';
import type { Camera, FeedEvent, ReportType } from '../types';
import { supabase } from '../api/supabase';
import { castVote, ensureSession, loadFeed, submitReport, type ReportResult, type Vote } from '../api/feedApi';
import { applyVoteDelta, rowToEvent, type EventRow } from '../api/mappers';
import { CAMERAS } from '../data/cameras';
import { DEMO_EVENTS } from '../data/demoEvents';
import { orderFeed } from './ranking';

export type FeedState = {
  mode: 'live' | 'demo';
  status: 'loading' | 'ready' | 'error';
  error?: string;
  cameras: Record<string, Camera>;
  /** Ordered once per load, then only updated in place so the feed doesn't reshuffle under the user. */
  events: FeedEvent[];
  myVotes: Record<string, Vote>;
  openedAt: number;
};

const byId = (cams: Camera[]) => Object.fromEntries(cams.map((c) => [c.id, c]));

function demoState(): FeedState {
  const openedAt = Date.now();
  return {
    mode: 'demo',
    status: 'ready',
    cameras: byId(CAMERAS),
    events: orderFeed(DEMO_EVENTS, openedAt),
    myVotes: {},
    openedAt,
  };
}

export function useFeed() {
  const [state, setState] = useState<FeedState>(() =>
    supabase
      ? { mode: 'live', status: 'loading', cameras: {}, events: [], myVotes: {}, openedAt: Date.now() }
      : demoState(),
  );
  const votesRef = useRef(state.myVotes);
  useEffect(() => {
    votesRef.current = state.myVotes;
  }, [state.myVotes]);

  const reload = useCallback(async () => {
    if (!supabase) return;
    setState((s) => ({ ...s, status: 'loading', error: undefined }));
    try {
      await ensureSession(supabase);
      const { cameras, events, myVotes } = await loadFeed(supabase);
      const openedAt = Date.now();
      setState({
        mode: 'live',
        status: 'ready',
        cameras: byId(cameras),
        events: orderFeed(events, openedAt),
        myVotes,
        openedAt,
      });
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live vote counters and newly published events.
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    const channel = sb
      .channel('events-feed')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, (payload) => {
        const row = rowToEvent(payload.new as EventRow);
        setState((s) => ({
          ...s,
          events: s.events.map((e) => (e.id === row.id
              ? {
                  ...e,
                  votesUp: row.votesUp,
                  votesDown: row.votesDown,
                  alertLevel: row.alertLevel,
                  alertActive: row.alertActive,
                  clipUrl: row.clipUrl,
                  posterUrl: row.posterUrl,
                }
              : e)),
        }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        const row = rowToEvent(payload.new as EventRow);
        // New events go right after the one being watched: never yank the current screen away.
        setState((s) =>
          s.events.some((e) => e.id === row.id) ? s : { ...s, events: [...s.events.slice(0, 1), row, ...s.events.slice(1)] },
        );
      })
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, []);

  const vote = useCallback(async (eventId: string, value: Vote) => {
    const previous = votesRef.current[eventId] ?? 0;
    if (previous === value) return;
    const apply = (from: Vote, to: Vote) =>
      setState((s) => ({
        ...s,
        myVotes: { ...s.myVotes, [eventId]: to },
        events: s.events.map((e) => (e.id === eventId ? applyVoteDelta(e, from, to) : e)),
      }));

    apply(previous, value);
    if (!supabase) return;
    try {
      await castVote(supabase, eventId, value);
    } catch {
      apply(value, previous); // roll back the optimistic update
    }
  }, []);

  const report = useCallback(async (cameraId: string, type: ReportType): Promise<ReportResult> => {
    if (!supabase) return { status: 'recorded' };
    return submitReport(supabase, cameraId, type);
  }, []);

  return { ...state, reload, vote, report };
}
