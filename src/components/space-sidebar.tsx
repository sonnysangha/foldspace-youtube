import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';

/** Tree of every space, shown beside the canvas on wide screens. */
export function SpaceSidebar({ activeId, topInset }: { activeId: Id<'spaces'>; topInset: number }) {
  const theme = useTheme();
  const router = useRouter();
  const spaces = useQuery(api.spaces.listAll) ?? [];

  const childrenOf = new Map<string, Doc<'spaces'>[]>();
  for (const space of spaces) {
    const key = space.parentId ?? 'root';
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), space]);
  }

  function renderLevel(parent: string, depth: number): React.ReactNode {
    return (childrenOf.get(parent) ?? []).map((space) => {
      const active = space._id === activeId;
      return (
        <View key={space._id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Go to space ${space.name}`}
            onPress={() => router.replace({ pathname: '/space/[id]', params: { id: space._id } })}
            style={[
              styles.row,
              { paddingLeft: Spacing.three + depth * 16 },
              active && { backgroundColor: theme.backgroundSelected },
            ]}>
            <View style={[styles.dot, { backgroundColor: space.color }]} />
            <Text numberOfLines={1} style={[styles.name, { color: theme.text, fontWeight: active ? '700' : '500' }]}>
              {space.name}
            </Text>
          </Pressable>
          {depth < 12 ? renderLevel(space._id, depth + 1) : null}
        </View>
      );
    });
  }

  return (
    <ScrollView
      style={[styles.sidebar, { backgroundColor: theme.background, borderRightColor: theme.border }]}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: Spacing.four }}>
      <Text style={[styles.heading, { color: theme.textSecondary }]}>ALL SPACES</Text>
      {renderLevel('root', 0)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 280, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  heading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, padding: Spacing.three, paddingBottom: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingRight: Spacing.three },
  dot: { width: 12, height: 12, borderRadius: 4 },
  name: { fontSize: 15, flex: 1 },
});
