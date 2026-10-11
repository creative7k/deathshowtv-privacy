import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import type { Camera } from '../types';
import { ooiWindow } from '../feed/schedule';

type Props = { camera: Camera; active: boolean };

/** Full-screen media for a camera: our own native player for HLS, refreshed image otherwise. */
export function CameraMedia({ camera, active }: Props) {
  if (camera.feed.kind === 'hls') {
    return <LiveStream url={camera.feed.url} ooi={camera.feed.schedule === 'ooi-every-3h'} active={active} />;
  }
  return <RefreshingImage url={camera.feed.url} refreshSec={camera.feed.refreshSec} active={active} />;
}

function LiveStream({ url, ooi, active }: { url: string; ooi: boolean; active: boolean }) {
  const player = useVideoPlayer({ uri: url, contentType: 'hls' }, (p) => {
    p.muted = true;
    p.loop = true;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />
      {status === 'error' && (
        <Fallback
          title={ooi ? 'Hors direct' : 'Flux indisponible'}
          subtitle={
            ooi
              ? `Prochain direct à ${ooiWindow(new Date()).next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'La caméra ne répond pas pour le moment.'
          }
        />
      )}
      {status === 'loading' && <Fallback title="Connexion au direct…" />}
    </View>
  );
}

function RefreshingImage({ url, refreshSec, active }: { url: string | null; refreshSec: number; active: boolean }) {
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active || !url) return;
    const id = setInterval(() => setTick((t) => t + 1), refreshSec * 1000);
    return () => clearInterval(id);
  }, [active, url, refreshSec]);

  if (!url) return <Fallback title="Image bientôt disponible" subtitle="Branchée par le service d’ingestion (étape 4)." />;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        style={StyleSheet.absoluteFill}
        source={{ uri: `${url}${url.includes('?') ? '&' : '?'}t=${tick}` }}
        contentFit="cover"
        transition={400}
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
      />
      {failed && <Fallback title="Image indisponible" subtitle="La caméra ne répond pas pour le moment." />}
    </View>
  );
}

function Fallback({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.fallback]}>
      <Text style={styles.fallbackTitle}>{title}</Text>
      {subtitle ? <Text style={styles.fallbackSub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0D12', padding: 32 },
  fallbackTitle: { color: '#E8ECF4', fontSize: 18, fontWeight: '700' },
  fallbackSub: { color: '#8A93A6', fontSize: 14, marginTop: 6, textAlign: 'center' },
});
