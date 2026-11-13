import { useQuery } from 'convex/react';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../../convex/_generated/api';

/** "Your Foldspace": a summary of the signed-in user's spaces, shown inside Clerk's profile. */
export function YourFoldspacePage() {
  const theme = useTheme();
  const router = useRouter();
  const spaces = useQuery(api.spaces.listAll);

  if (spaces === undefined) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const roots = spaces.filter((space) => space.parentId === undefined);
  const stats = [
    { label: 'Spaces', value: spaces.length },
    { label: 'Top level', value: roots.length },
    { label: 'Nested', value: spaces.length - roots.length },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={[styles.statValue, { color: theme.accent }]}>{stat.value}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {stat.label}
            </ThemedText>
          </View>
        ))}
      </View>

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        JUMP BACK IN
      </ThemedText>
      {roots.length === 0 ? (
        <ThemedText themeColor="textSecondary">No spaces yet. Create one from the home screen.</ThemedText>
      ) : (
        <View style={styles.chips}>
          {roots.map((space) => (
            <Pressable
              key={space._id}
              accessibilityRole="button"
              accessibilityLabel={`Open space ${space.name}`}
              onPress={() => router.push({ pathname: '/space/[id]', params: { id: space._id } })}>
              {({ pressed }) => (
                <View style={[styles.chip, { backgroundColor: space.color, opacity: pressed ? 0.85 : 1 }]}>
                  <ThemedText style={styles.chipText} numberOfLines={1}>
                    {space.name}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/** "About Foldspace": what the app is and which version is installed. */
export function AboutFoldspacePage() {
  const theme = useTheme();
  const version = Constants.expoConfig?.version;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={[styles.hero, { backgroundColor: theme.accent }]}>
        <ThemedText style={[styles.heroTitle, { color: theme.onAccent }]}>Foldspace</ThemedText>
        <ThemedText style={{ color: theme.onAccent }}>
          Spaces inside spaces. Notes, to-dos, drawings and images on an endless canvas.
        </ThemedText>
      </View>
      {version ? (
        <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText>Version</ThemedText>
          <ThemedText themeColor="textSecondary">{version}</ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  stat: {
    flex: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  statValue: { fontSize: 28, lineHeight: 34, fontWeight: 700 },
  sectionLabel: { letterSpacing: 0.5, marginTop: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: 220,
  },
  chipText: { color: '#FFFFFF', fontWeight: 700 },
  hero: { borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
  heroTitle: { fontSize: 28, lineHeight: 34, fontWeight: 700 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
});
