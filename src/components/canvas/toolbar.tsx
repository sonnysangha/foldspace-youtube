import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  onAddNote: () => void;
  onAddTodo: () => void;
  onAddSpace: () => void;
  onAddImage: () => void;
  onResetView: () => void;
};

/** Floating bar for adding things to the canvas. */
export function CanvasToolbar({ onAddNote, onAddTodo, onAddSpace, onAddImage, onResetView }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tools = [
    { label: 'Note', glyph: '✎', onPress: onAddNote },
    { label: 'To-do', glyph: '☑', onPress: onAddTodo },
    { label: 'Space', glyph: '▣', onPress: onAddSpace },
    { label: 'Image', glyph: '▨', onPress: onAddImage },
    { label: 'Centre', glyph: '⌖', onPress: onResetView },
  ];
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, Spacing.three) }]}>
      <View style={[styles.bar, { backgroundColor: theme.background, borderColor: theme.border }]}>
        {tools.map((tool) => (
          <Pressable
            key={tool.label}
            accessibilityRole="button"
            accessibilityLabel={tool.label === 'Centre' ? 'Centre the canvas' : `Add ${tool.label}`}
            onPress={tool.onPress}
            style={({ pressed }) => [styles.tool, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
            <Text style={[styles.glyph, { color: theme.accent }]}>{tool.glyph}</Text>
            <Text style={[styles.label, { color: theme.text }]}>{tool.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.16)',
  },
  tool: { minWidth: 58, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
  glyph: { fontSize: 20, lineHeight: 24 },
  label: { fontSize: 12, fontWeight: '600' },
});
