import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Camera, EventStore, PendingEvent } from './types.ts';

/** Server-side access with the service-role key (bypasses RLS: never ship this key in the app). */
export class SupabaseStore implements EventStore {
  private readonly sb: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.sb = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listCameras(): Promise<Camera[]> {
    const { data, error } = await this.sb
      .from('cameras')
      .select('id, feed_kind, feed_url, page_url, refresh_sec, schedule')
      .eq('active', true);
    if (error) throw error;
    return data as Camera[];
  }

  async listPendingEvents(sinceMs: number): Promise<PendingEvent[]> {
    const { data, error } = await this.sb
      .from('events')
      .select('id, camera_id, started_at')
      .is('clip_url', null)
      .eq('status', 'published')
      .gte('started_at', new Date(Date.now() - sinceMs).toISOString())
      .order('started_at');
    if (error) throw error;
    return data as PendingEvent[];
  }

  async setClip(eventId: string, clipUrl: string, posterUrl: string): Promise<void> {
    const { error } = await this.sb.from('events').update({ clip_url: clipUrl, poster_url: posterUrl }).eq('id', eventId);
    if (error) throw error;
  }
}
