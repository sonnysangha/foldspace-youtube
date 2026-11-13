import { UserButton } from '@clerk/expo/native-components';
import { useConvexAuth, useQuery } from 'convex/react';
import { Link, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Welcome } from '@/components/auth/welcome';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../convex/_generated/api';

export default function HomeScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Welcome />
      </>
    );
  }
  return <SpacesHome />;
}

function SpacesHome() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useLayout();
  const spaces = useQuery(api.spaces.listRoot);

  // As many ~170pt columns as fit, so phones get 2 and unfolded foldables get 4+.
  const columns = Math.max(2, Math.floor(width / 190));
  const cardWidth = (width - Spacing.three * (columns + 1)) / columns;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Spaces',
          headerLeft: () => (
            <View style={styles.avatar}>
              <UserButton />
            </View>
          ),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New space"
              hitSlop={12}
              onPress={() => router.push('/new-space')}>
              <ThemedText style={{ color: theme.accent, fontSize: 28, lineHeight: 30 }}>＋</ThemedText>
            </Pressable>
          ),
        }}
      />
      {spaces === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          key={columns}
          data={spaces}
          numColumns={columns}
          keyExtractor={(space) => space._id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three, flexGrow: 1 }}
          columnWrapperStyle={{ gap: Spacing.three }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
                No spaces yet
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Tap ＋ to create your first space.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/space/[id]', params: { id: item._id } }} asChild>
              {/* Link asChild drops a function `style` on Android, so the pressed
                  state is applied to an inner View instead of the Pressable. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open space ${item.name}`}
                style={{ width: cardWidth }}>
                {({ pressed }) => (
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: item.color, transform: [{ scale: pressed ? 0.97 : 1 }] },
                    ]}>
                    <ThemedText style={styles.cardTitle} numberOfLines={3}>
                      {item.name}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  // Android's header puts the title flush against headerLeft, so add a gap there.
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: Platform.OS === 'android' ? Spacing.three : 0,
  },
  card: {
    height: 130,
    borderRadius: Radius.large,
    padding: Spacing.three,
    justifyContent: 'flex-end',
  },
  cardTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: 700 },
});
