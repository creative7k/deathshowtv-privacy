import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Vote } from '../api/feedApi';

type Props = {
  votesUp: number;
  votesDown: number;
  myVote: Vote;
  onVote: (v: Vote) => void;
  onReport: () => void;
};

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Right-hand action column: real/fake alert vote and report button. */
export function ActionRail({ votesUp, votesDown, myVote, onVote, onReport }: Props) {
  return (
    <View style={styles.rail}>
      <Action
        icon="👍"
        label={compact(votesUp)}
        caption="Vrai"
        selected={myVote === 1}
        onPress={() => onVote(myVote === 1 ? 0 : 1)}
      />
      <Action
        icon="👎"
        label={compact(votesDown)}
        caption="Faux"
        selected={myVote === -1}
        onPress={() => onVote(myVote === -1 ? 0 : -1)}
      />
      <Action icon="🚩" label="Signaler" onPress={onReport} />
    </View>
  );
}

function Action({
  icon,
  label,
  caption,
  selected,
  onPress,
}: {
  icon: string;
  label: string;
  caption?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={caption ?? label}>
      <View style={[styles.bubble, selected && styles.bubbleSelected]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { alignItems: 'center', gap: 18 },
  action: { alignItems: 'center' },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bubbleSelected: { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.18)' },
  icon: { fontSize: 24 },
  label: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 4 },
  caption: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
});
