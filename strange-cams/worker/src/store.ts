import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Camera, CameraUpsert, EventStore, NewAlertEvent, PendingEvent } from './types.ts';

/** Server-side access with the service-role key (bypasses RLS: never ship this key in the app). */
export class SupabaseStore implements EventStore {
  readonly sb: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.sb = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listCameras(): Promise<Camera[]> {
    const { data, error } = await this.sb
      .from('cameras')
      .select('id, category, feed_kind, feed_url, page_url, refresh_sec, schedule, lat, lon, featured')
      .eq('active', true)
      .range(0, 9999);
    if (error) throw error;
    return data as Camera[];
  }

  async listPendingEvents(sinceMs: number): Promise<PendingEvent[]> {
    const { data, error } = await this.sb
      .from('events')
      .select('id, camera_id, started_at, origin')
      .is('clip_url', null)
      .eq('status', 'published')
      .gte('started_at', new Date(Date.now() - sinceMs).toISOString())
      .order('started_at');
    if (error) throw error;
    return data as PendingEvent[];
  }

  async createAlertEvent(ev: NewAlertEvent): Promise<string | null> {
    const { data, error } = await this.sb
      .from('events')
      .insert({ ...ev, origin: 'alert', status: 'published', alert_active: true })
      .select('id')
      .single();
    if (error?.code === '23505') return null; // this alert already has its event
    if (error) throw error;
    return data.id as string;
  }

  async expireAlerts(olderThanMs: number): Promise<void> {
    const { error } = await this.sb
      .from('events')
      .update({ alert_active: false })
      .eq('alert_active', true)
      .eq('origin', 'alert')
      .lt('started_at', new Date(Date.now() - olderThanMs).toISOString());
    if (error) throw error;
  }

  async upsertCameras(rows: CameraUpsert[]): Promise<void> {
    // Featured flags and hand-made cameras are left untouched (not part of the payload).
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.sb.from('cameras').upsert(rows.slice(i, i + 500), { onConflict: 'id' });
      if (error) throw error;
    }
  }

  async setClip(eventId: string, clipUrl: string, posterUrl: string): Promise<void> {
    const { error } = await this.sb.from('events').update({ clip_url: clipUrl, poster_url: posterUrl }).eq('id', eventId);
    if (error) throw error;
  }
}
