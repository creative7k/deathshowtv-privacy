import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Camera, FeedEvent } from '../types';
import { categoryById } from '../data/categories';
import { ooiWindow } from '../feed/schedule';
import { CameraMedia } from './CameraMedia';
import { ActionRail } from './ActionRail';
import type { Vote } from '../api/feedApi';

type Props = {
  event: FeedEvent;
  camera: Camera;
  height: number;
  active: boolean;
  /** Only the active item and its neighbours mount a player. */
  mounted: boolean;
  myVote: Vote;
  /** Reference time for "x min ago" labels. */
  now: number;
  bottomInset: number;
  onVote: (v: Vote) => void;
  onReport: () => void;
};

const ago = (ms: number) => {
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.round(min / 60)} h`;
};

export const FeedItem = memo(function FeedItem({
  event,
  camera,
  height,
  active,
  mounted,
  myVote,
  now,
  bottomInset,
  onVote,
  onReport,
}: Props) {
  const category = categoryById(camera.category);
  const isLive =
    camera.feed.kind === 'hls' &&
    (camera.feed.schedule !== 'ooi-every-3h' || ooiWindow(new Date(now)).live);

  return (
    <View style={[styles.item, { height }]}>
      {mounted ? <CameraMedia camera={camera} clipUrl={event.clipUrl} active={active} /> : null}
      <View style={styles.shade} pointerEvents="none" />

      <View style={[styles.bottom, { paddingBottom: bottomInset + 20 }]} pointerEvents="box-none">
        <View style={styles.info} pointerEvents="none">
          <View style={styles.badges}>
            <Badge text={`${category.emoji} ${category.label}`} color={category.color} />
            {event.paranormal && <Badge text="👁️ Paranormal" color={categoryById('paranormal').color} />}
            {event.clipUrl ? (
              <Badge text={camera.feed.kind === 'hls' ? '▶ REPLAY' : '◷ TIME-LAPSE'} color="#9AA4B8" />
            ) : (
              <Badge
                text={isLive ? '● LIVE' : camera.feed.kind === 'hls' ? '◌ HORS DIRECT' : '◉ EN DIRECT'}
                color={isLive ? '#FF3B5C' : '#9AA4B8'}
                solid={isLive}
              />
            )}
            {event.alertActive && <Badge text={`⚠ ALERTE ${event.alertLevel}`} color="#FFB020" solid />}
          </View>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.desc}>{event.description}</Text>
          <Text style={styles.meta}>
            {camera.name} · {camera.place}
          </Text>
          <Text style={styles.meta}>
            {ago(now - event.startedAt)} · Source : {camera.credit} ({camera.licence})
          </Text>
        </View>
        <ActionRail
          votesUp={event.votesUp}
          votesDown={event.votesDown}
          myVote={myVote}
          onVote={onVote}
          onReport={onReport}
        />
      </View>
    </View>
  );
});

function Badge({ text, color, solid }: { text: string; color: string; solid?: boolean }) {
  return (
    <View style={[styles.badge, solid ? { backgroundColor: color } : { borderColor: color, borderWidth: 1 }]}>
      <Text style={[styles.badgeText, { color: solid ? '#0B0D12' : color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { width: '100%', backgroundColor: '#0B0D12', overflow: 'hidden' },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 12,
  },
  info: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.4)' },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  desc: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 4 },
  meta: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 6 },
});
