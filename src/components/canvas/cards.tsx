import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardInk, Radius, Spacing } from '@/constants/theme';
import type { CanvasItem, Task } from './types';

type CardProps = {
  item: CanvasItem;
  onOpen: () => void;
  onToggleTask: (taskId: string) => void;
};

/** Renders the right card for an item. Size comes from the item itself. */
export function ItemCard({ item, onOpen, onToggleTask }: CardProps) {
  const size = { width: item.width, height: item.height };
  const content = item.content;

  if (content.kind === 'note') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Note: ${content.text || 'empty'}`}
        onPress={onOpen}
        style={[styles.card, size, { backgroundColor: content.color }]}>
        <Text style={[styles.noteText, !content.text && styles.placeholder]}>
          {content.text || 'Tap to write'}
        </Text>
      </Pressable>
    );
  }

  if (content.kind === 'todo') {
    const done = content.tasks.filter((task) => task.done).length;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`To-do list: ${content.title || 'untitled'}`}
        onPress={onOpen}
        style={[styles.card, size, styles.todo]}>
        <View style={styles.todoHeader}>
          <Text style={styles.todoTitle} numberOfLines={1}>
            {content.title || 'To-do'}
          </Text>
          <Text style={styles.todoCount}>
            {done}/{content.tasks.length}
          </Text>
        </View>
        {content.tasks.length === 0 ? (
          <Text style={[styles.taskText, styles.placeholder]}>Tap to add tasks</Text>
        ) : (
          content.tasks.slice(0, 6).map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => onToggleTask(task.id)} />
          ))
        )}
      </Pressable>
    );
  }

  // Other kinds (drawings, images) get their own cards as those features land.
  if (content.kind !== 'space') return null;

  const color = item.child?.color ?? '#6C5CE7';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open nested space ${item.child?.name ?? ''}`}
      onPress={onOpen}
      style={[styles.card, size, styles.space, { backgroundColor: color }]}>
      <View style={styles.spaceTab} />
      <Text style={styles.spaceName} numberOfLines={2}>
        {item.child?.name ?? 'Space'}
      </Text>
      <Text style={styles.spaceHint}>Tap to open ›</Text>
    </Pressable>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done }}
      accessibilityLabel={task.text}
      hitSlop={6}
      onPress={onToggle}
      style={styles.taskRow}>
      <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
        {task.done ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={[styles.taskText, task.done && styles.taskDone]} numberOfLines={1}>
        {task.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    overflow: 'hidden',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
  },
  placeholder: { opacity: 0.45 },
  noteText: { color: CardInk.text, fontSize: 16, lineHeight: 22 },
  todo: { backgroundColor: '#FFFFFF', gap: Spacing.two },
  todoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todoTitle: { color: CardInk.text, fontSize: 16, fontWeight: '700', flex: 1 },
  todoCount: { color: CardInk.secondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 24 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#B8BAC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  check: { color: '#FFFFFF', fontSize: 13, lineHeight: 15, fontWeight: '700' },
  taskText: { color: CardInk.text, fontSize: 15, flex: 1 },
  taskDone: { color: CardInk.secondary, textDecorationLine: 'line-through' },
  space: { justifyContent: 'flex-end' },
  spaceTab: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 44,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  spaceName: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '700' },
  spaceHint: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 13, marginTop: 2 },
});
