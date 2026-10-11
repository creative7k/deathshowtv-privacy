import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CATEGORIES } from '../data/categories';
import type { CategoryId } from '../types';

type Props = {
  selected: CategoryId | null;
  onSelect: (id: CategoryId | null) => void;
};

/** Horizontal filter overlaid on the top of the feed. `null` = "Pour toi" (all categories). */
export function CategoryBar({ selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="Pour toi" active={selected === null} onPress={() => onSelect(null)} />
      {CATEGORIES.map((c) => (
        <Chip
          key={c.id}
          label={`${c.emoji} ${c.label}`}
          active={selected === c.id}
          onPress={() => onSelect(selected === c.id ? null : c.id)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.35)' },
  chipActive: { backgroundColor: '#FFFFFF' },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },
  labelActive: { color: '#0B0D12' },
});
