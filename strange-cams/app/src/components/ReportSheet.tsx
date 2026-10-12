import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReportType } from '../types';

const REPORT_TYPES: { id: ReportType; label: string; emoji: string }[] = [
  { id: 'animal', label: 'Animal', emoji: '🐾' },
  { id: 'lumiere', label: 'Lumière étrange', emoji: '✨' },
  { id: 'meteo', label: 'Météo extrême', emoji: '🌪️' },
  { id: 'eruption', label: 'Éruption / activité', emoji: '🌋' },
  { id: 'trafic', label: 'Accident / trafic', emoji: '🚨' },
  { id: 'inexplique', label: 'Inexpliqué', emoji: '👁️' },
  { id: 'autre', label: 'Autre', emoji: '❓' },
];

type Props = {
  visible: boolean;
  cameraName: string;
  onClose: () => void;
  onSubmit: (type: ReportType) => void;
};

export function ReportSheet({ visible, cameraName, onClose, onSubmit }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Qu’est-ce que tu vois ?</Text>
        <Text style={styles.subtitle}>{cameraName}</Text>
        <View style={styles.grid}>
          {REPORT_TYPES.map((t) => (
            <Pressable key={t.id} style={styles.chip} onPress={() => onSubmit(t.id)}>
              <Text style={styles.chipEmoji}>{t.emoji}</Text>
              <Text style={styles.chipLabel}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#151821', padding: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A4152', marginBottom: 14 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#8A93A6', fontSize: 14, marginTop: 2, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#222736',
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { color: '#E8ECF4', fontSize: 15, fontWeight: '600' },
});
