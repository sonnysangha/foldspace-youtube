import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { newTaskId, type Task } from '@/components/canvas/types';
import { ThemedText } from '@/components/themed-text';
import { NoteColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

/** Sheet for editing a note or a to-do list. */
export default function ItemSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const item = useQuery(api.items.get, { itemId: id as Id<'items'> });

  if (item === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (item === null || (item.content.kind !== 'note' && item.content.kind !== 'todo')) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ThemedText>This item no longer exists.</ThemedText>
      </View>
    );
  }
  // Keyed so the local draft starts from the saved content exactly once.
  return <Editor key={item._id} item={item} />;
}

function Editor({ item }: { item: Doc<'items'> }) {
  const theme = useTheme();
  const router = useRouter();
  const updateItem = useMutation(api.items.update);
  const removeItem = useMutation(api.items.remove);

  const initial = item.content;
  const [text, setText] = useState(initial.kind === 'note' ? initial.text : '');
  const [color, setColor] = useState(initial.kind === 'note' ? initial.color : '');
  const [title, setTitle] = useState(initial.kind === 'todo' ? initial.title : '');
  const [tasks, setTasks] = useState<Task[]>(initial.kind === 'todo' ? initial.tasks : []);
  const [draft, setDraft] = useState('');

  async function save() {
    if (initial.kind === 'note') {
      await updateItem({ itemId: item._id, content: { kind: 'note', text, color } });
    } else {
      const pending = draft.trim();
      const all = pending ? [...tasks, { id: newTaskId(), text: pending, done: false }] : tasks;
      await updateItem({ itemId: item._id, content: { kind: 'todo', title, tasks: all } });
    }
    router.back();
  }

  async function remove() {
    await removeItem({ itemId: item._id });
    router.back();
  }

  function addTask() {
    const value = draft.trim();
    if (!value) return;
    setTasks((current) => [...current, { id: newTaskId(), text: value, done: false }]);
    setDraft('');
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      {initial.kind === 'note' ? (
        <>
          <TextInput
            autoFocus={!text}
            multiline
            accessibilityLabel="Note text"
            placeholder="Write something"
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            style={[inputStyle, styles.noteInput]}
          />
          <View style={styles.swatches}>
            {NoteColors.map((swatch) => (
              <Pressable
                key={swatch}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${swatch}`}
                onPress={() => setColor(swatch)}
                style={[
                  styles.swatch,
                  { backgroundColor: swatch, borderColor: color === swatch ? theme.accent : theme.border },
                ]}
              />
            ))}
          </View>
        </>
      ) : (
        <>
          <TextInput
            accessibilityLabel="List title"
            placeholder="List title"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
            style={[inputStyle, { fontWeight: '700' }]}
          />
          {tasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: task.done }}
                accessibilityLabel={task.text}
                hitSlop={10}
                onPress={() =>
                  setTasks((current) =>
                    current.map((entry) => (entry.id === task.id ? { ...entry, done: !entry.done } : entry)),
                  )
                }
                style={[
                  styles.checkbox,
                  { borderColor: theme.border },
                  task.done && { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}>
                {task.done ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
              <Text
                style={[
                  styles.taskText,
                  { color: task.done ? theme.textSecondary : theme.text },
                  task.done && { textDecorationLine: 'line-through' },
                ]}>
                {task.text}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove task ${task.text}`}
                hitSlop={10}
                onPress={() => setTasks((current) => current.filter((entry) => entry.id !== task.id))}>
                <Text style={{ color: theme.textSecondary, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <TextInput
            accessibilityLabel="New task"
            placeholder="Add a task"
            placeholderTextColor={theme.textSecondary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addTask}
            submitBehavior="submit"
            returnKeyType="done"
            style={inputStyle}
          />
        </>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={save}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText style={{ color: theme.onAccent, fontWeight: 700 }}>Save</ThemedText>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={remove} style={styles.button}>
        <ThemedText style={{ color: theme.danger, fontWeight: 600 }}>Delete</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four, gap: Spacing.three },
  input: { fontSize: 17, padding: Spacing.three, borderRadius: Radius.medium, minHeight: 50 },
  noteInput: { minHeight: 140, textAlignVertical: 'top' },
  swatches: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 44 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  check: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  taskText: { flex: 1, fontSize: 16 },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: Radius.medium },
});
