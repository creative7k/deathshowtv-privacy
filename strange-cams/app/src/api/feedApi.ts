import type { SupabaseClient } from '@supabase/supabase-js';
import type { Camera, FeedEvent, ReportType } from '../types';
import { rowToCamera, rowToEvent, type CameraRow, type EventRow } from './mappers';

export type Vote = -1 | 0 | 1;

const FEED_WINDOW_MS = 48 * 3_600_000;

/** Every visitor gets an anonymous account so they can vote and report without signing up. */
export async function ensureSession(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (error || !signed.user) throw error ?? new Error('anonymous sign-in failed');
  return signed.user.id;
}

export async function loadFeed(sb: SupabaseClient): Promise<{
  cameras: Camera[];
  events: FeedEvent[];
  myVotes: Record<string, Vote>;
}> {
  const since = new Date(Date.now() - FEED_WINDOW_MS).toISOString();
  const [cams, evs, votes] = await Promise.all([
    sb.from('cameras').select('*'),
    sb
      .from('events')
      .select('id, camera_id, origin, title, description, paranormal, started_at, votes_up, votes_down, alert_level, alert_active, clip_url, poster_url')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(200),
    sb.from('votes').select('event_id, value'),
  ]);
  if (cams.error) throw cams.error;
  if (evs.error) throw evs.error;
  if (votes.error) throw votes.error;

  const myVotes: Record<string, Vote> = {};
  for (const v of votes.data as { event_id: string; value: -1 | 1 }[]) myVotes[v.event_id] = v.value;

  return {
    cameras: (cams.data as CameraRow[]).map(rowToCamera),
    events: (evs.data as EventRow[]).map(rowToEvent),
    myVotes,
  };
}

/**
 * Sets, changes or removes the current user's vote.
 * Update-then-insert rather than upsert: clients may only update the `value` column.
 */
export async function castVote(sb: SupabaseClient, eventId: string, value: Vote): Promise<void> {
  if (value === 0) {
    const { error } = await sb.from('votes').delete().eq('event_id', eventId);
    if (error) throw error;
    return;
  }
  const upd = await sb.from('votes').update({ value }).eq('event_id', eventId).select('event_id');
  if (upd.error) throw upd.error;
  if (upd.data.length > 0) return;
  const ins = await sb.from('votes').insert({ event_id: eventId, value });
  if (ins.error) throw ins.error;
}

export type ReportResult = { status: 'event'; eventId: string } | { status: 'recorded' } | { status: 'rate-limited' };

export async function submitReport(
  sb: SupabaseClient,
  cameraId: string,
  type: ReportType,
  note?: string,
): Promise<ReportResult> {
  const { data, error } = await sb.rpc('submit_report', {
    p_camera_id: cameraId,
    p_type: type,
    p_note: note ?? null,
  });
  if (error) {
    if (error.hint === 'rate_limited') return { status: 'rate-limited' };
    throw error;
  }
  return data ? { status: 'event', eventId: data as string } : { status: 'recorded' };
}
