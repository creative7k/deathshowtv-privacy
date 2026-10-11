import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Camera, CategoryId, FeedEvent, ReportType } from '../types';
import { useFeed } from '../feed/useFeed';
import { FeedItem } from '../components/FeedItem';
import { CategoryBar } from '../components/CategoryBar';
import { ReportSheet } from '../components/ReportSheet';

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

const matches = (e: FeedEvent, camera: Camera, cat: CategoryId | null) =>
  cat === null || (cat === 'paranormal' ? e.paranormal : camera.category === cat);

const REPORT_MESSAGES = {
  event: 'Événement confirmé · il arrive dans le feed !',
  recorded: 'Signalement envoyé · merci !',
  'rate-limited': 'Tu as déjà signalé cette caméra, réessaie dans 2 min',
} as const;

export function FeedScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const feed = useFeed();

  const [category, setCategory] = useState<CategoryId | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reporting, setReporting] = useState<FeedEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<FlatList<FeedEvent>>(null);

  const events = useMemo(
    () =>
      feed.events.filter((e) => {
        const camera = feed.cameras[e.cameraId];
        return camera !== undefined && matches(e, camera, category);
      }),
    [feed.events, feed.cameras, category],
  );

  // Must keep a stable identity: FlatList does not support changing it on the fly.
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<FeedEvent>[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActiveIndex(first.index);
  }, []);

  const selectCategory = useCallback((id: CategoryId | null) => {
    setCategory(id);
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const submitReport = async (type: ReportType) => {
    if (!reporting) return;
    const cameraId = reporting.cameraId;
    setReporting(null);
    try {
      const result = await feed.report(cameraId, type);
      showToast(REPORT_MESSAGES[result.status]);
    } catch {
      showToast('Envoi impossible, vérifie ta connexion');
    }
  };

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={({ item, index }) => (
          <FeedItem
            event={item}
            camera={feed.cameras[item.cameraId]}
            height={height}
            active={index === activeIndex}
            mounted={Math.abs(index - activeIndex) <= 1}
            myVote={feed.myVotes[item.id] ?? 0}
            now={feed.openedAt}
            bottomInset={insets.bottom}
            onVote={(v) => void feed.vote(item.id, v)}
            onReport={() => setReporting(item)}
          />
        )}
        extraData={{ activeIndex, myVotes: feed.myVotes }}
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        windowSize={3}
        initialNumToRender={2}
        ListEmptyComponent={
          <View style={[styles.empty, { height }]}>
            {feed.status === 'loading' ? (
              <ActivityIndicator color="#fff" />
            ) : feed.status === 'error' ? (
              <>
                <Text style={styles.emptyText}>Impossible de charger le feed</Text>
                <Pressable onPress={() => void feed.reload()} style={styles.retry}>
                  <Text style={styles.retryText}>Réessayer</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.emptyText}>Rien d’étrange ici pour l’instant…</Text>
            )}
          </View>
        }
      />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Text style={styles.logo}>STRANGE CAMS</Text>
        <CategoryBar selected={category} onSelect={selectCategory} />
        {feed.mode === 'demo' && <Text style={styles.demo}>Données de démonstration</Text>}
      </View>

      {toast && (
        <View style={[styles.toast, { top: insets.top + 110 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <ReportSheet
        visible={reporting !== null}
        cameraName={reporting ? (feed.cameras[reporting.cameraId]?.name ?? '') : ''}
        onClose={() => setReporting(null)}
        onSubmit={(type) => void submitReport(type)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0D12' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: 8 },
  logo: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  demo: { color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: '#8A93A6', fontSize: 16 },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#222736' },
  retryText: { color: '#fff', fontWeight: '700' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { color: '#0B0D12', fontWeight: '700' },
});
