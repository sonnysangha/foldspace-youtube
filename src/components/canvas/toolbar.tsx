import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DrawColors } from './drawing';

type Props = {
  onAddNote: () => void;
  onAddTodo: () => void;
  onAddSpace: () => void;
  onResetView: () => void;
  /** Whether Draw mode is on. */
  drawing: boolean;
  onToggleDraw: () => void;
  drawColor: string;
  onPickDrawColor: (color: string) => void;
  /** Removes the most recent stroke of this drawing session, when there is one. */
  onUndoStroke?: () => void;
};

/** Floating bar for adding things to the canvas. */
export function CanvasToolbar({
  onAddNote,
  onAddTodo,
  onAddSpace,
  onResetView,
  drawing,
  onToggleDraw,
  drawColor,
  onPickDrawColor,
  onUndoStroke,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tools = [
    { label: 'Note', glyph: '✎', hint: 'Add Note', onPress: onAddNote, active: false },
    { label: 'To-do', glyph: '☑', hint: 'Add To-do', onPress: onAddTodo, active: false },
    { label: 'Space', glyph: '▣', hint: 'Add Space', onPress: onAddSpace, active: false },
    { label: 'Draw', glyph: '〰', hint: drawing ? 'Stop drawing' : 'Draw', onPress: onToggleDraw, active: drawing },
    { label: 'Centre', glyph: '⌖', hint: 'Centre the canvas', onPress: onResetView, active: false },
  ];
  const surface = { backgroundColor: theme.background, borderColor: theme.border };
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, Spacing.three) }]}>
      {drawing ? (
        <View style={[styles.bar, styles.pens, surface]}>
          {DrawColors.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`Pen colour ${color}`}
              accessibilityState={{ selected: color === drawColor }}
              hitSlop={6}
              onPress={() => onPickDrawColor(color)}
              style={[styles.swatchRing, color === drawColor && { borderColor: theme.text }]}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
            </Pressable>
          ))}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo last stroke"
            disabled={onUndoStroke === undefined}
            hitSlop={6}
            onPress={onUndoStroke}
            style={({ pressed }) => [styles.undo, { opacity: onUndoStroke === undefined ? 0.35 : pressed ? 0.6 : 1 }]}>
            <Text style={[styles.label, { color: theme.text }]}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.bar, surface]}>
        {tools.map((tool) => (
          <Pressable
            key={tool.label}
            accessibilityRole="button"
            accessibilityLabel={tool.hint}
            accessibilityState={{ selected: tool.active }}
            onPress={tool.onPress}
            style={({ pressed }) => [
              styles.tool,
              tool.active && { backgroundColor: theme.accent },
              { transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}>
            <Text style={[styles.glyph, { color: tool.active ? theme.onAccent : theme.accent }]}>{tool.glyph}</Text>
            <Text style={[styles.label, { color: tool.active ? theme.onAccent : theme.text }]}>{tool.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: Spacing.two },
  bar: {
    flexDirection: 'row',
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.16)',
  },
  pens: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  swatchRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 22, height: 22, borderRadius: 11 },
  divider: { width: StyleSheet.hairlineWidth, height: 22 },
  undo: { minHeight: 32, justifyContent: 'center', paddingHorizontal: Spacing.two },
  tool: {
    minWidth: 58,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.medium,
  },
  glyph: { fontSize: 20, lineHeight: 24 },
  label: { fontSize: 12, fontWeight: '600' },
});
