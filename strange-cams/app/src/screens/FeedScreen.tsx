import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CategoryId, FeedEvent, ReportType } from '../types';
import { DEMO_EVENTS } from '../data/demoEvents';
import { cameraById } from '../data/cameras';
import { orderFeed } from '../feed/ranking';
import { FeedItem } from '../components/FeedItem';
import { CategoryBar } from '../components/CategoryBar';
import { ReportSheet } from '../components/ReportSheet';
import type { Vote } from '../components/ActionRail';

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

const matches = (e: FeedEvent, cat: CategoryId | null) =>
  cat === null || (cat === 'paranormal' ? e.paranormal : cameraById(e.cameraId).category === cat);

export function FeedScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<CategoryId | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [reporting, setReporting] = useState<FeedEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<FlatList<FeedEvent>>(null);

  // Ordered once per session: the "random" tail must not reshuffle on every render.
  const [openedAt] = useState(() => Date.now());
  const [ordered] = useState(() => orderFeed(DEMO_EVENTS, openedAt));
  const events = useMemo(() => ordered.filter((e) => matches(e, category)), [ordered, category]);

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

  const submitReport = (type: ReportType) => {
    // Step 3 sends this to Supabase; for now it is only acknowledged locally.
    void type;
    setReporting(null);
    setToast('Signalement envoyé · merci !');
    setTimeout(() => setToast(null), 2200);
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
            height={height}
            active={index === activeIndex}
            mounted={Math.abs(index - activeIndex) <= 1}
            myVote={votes[item.id] ?? 0}
            now={openedAt}
            bottomInset={insets.bottom}
            onVote={(v) => setVotes((prev) => ({ ...prev, [item.id]: v }))}
            onReport={() => setReporting(item)}
          />
        )}
        extraData={{ activeIndex, votes }}
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
            <Text style={styles.emptyText}>Rien d’étrange ici pour l’instant…</Text>
          </View>
        }
      />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Text style={styles.logo}>STRANGE CAMS</Text>
        <CategoryBar selected={category} onSelect={selectCategory} />
        <Text style={styles.demo}>Données de démonstration · étape 1</Text>
      </View>

      {toast && (
        <View style={[styles.toast, { top: insets.top + 110 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <ReportSheet
        visible={reporting !== null}
        cameraName={reporting ? cameraById(reporting.cameraId).name : ''}
        onClose={() => setReporting(null)}
        onSubmit={submitReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0D12' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: 8 },
  logo: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  demo: { color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#8A93A6', fontSize: 16 },
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
