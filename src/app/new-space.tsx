import { useMutation } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, SpaceColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

/** Sheet for naming a new space. With a parentId it becomes a nested space. */
export default function NewSpaceSheet() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ parentId?: string; x?: string; y?: string }>();
  const createSpace = useMutation(api.spaces.create);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(SpaceColors[0]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      await createSpace({
        name,
        color,
        parentId: params.parentId as Id<'spaces'> | undefined,
        x: params.x ? Number(params.x) : undefined,
        y: params.y ? Number(params.y) : undefined,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TextInput
        autoFocus
        accessibilityLabel="Space name"
        placeholder={params.parentId ? 'Name this nested space' : 'Name this space'}
        placeholderTextColor={theme.textSecondary}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        returnKeyType="done"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
      <View style={styles.swatches}>
        {SpaceColors.map((swatch) => (
          <Pressable
            key={swatch}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${swatch}`}
            onPress={() => setColor(swatch)}
            style={[
              styles.swatch,
              { backgroundColor: swatch, borderColor: color === swatch ? theme.text : 'transparent' },
            ]}
          />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={submit}
        disabled={saving}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.accent, opacity: pressed || saving ? 0.7 : 1 },
        ]}>
        <ThemedText style={{ color: theme.onAccent, fontWeight: 700 }}>Create space</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.four },
  input: { fontSize: 18, padding: Spacing.three, borderRadius: Radius.medium, minHeight: 52 },
  swatches: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: Radius.medium },
});
