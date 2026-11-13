import Add from '@expo/material-symbols/add.xml';
import { useConvexAuth, useQuery } from 'convex/react';
import { Link, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Welcome } from '@/components/auth/welcome';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../../../convex/_generated/api';

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
  const [paneWidth, setPaneWidth] = useState(width);
  const insets = useSafeAreaInsets();
  const spaces = useQuery(api.spaces.listRoot);

  // As many ~170pt columns as fit, so phones get 2 and unfolded foldables get 4+.
  const contentWidth = paneWidth - insets.left - insets.right;
  const columns = Math.max(1, Math.floor(contentWidth / 190));
  const cardWidth = (contentWidth - Spacing.three * (columns + 1)) / columns;

  return (
    <View onLayout={(event) => setPaneWidth(event.nativeEvent.layout.width)} style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ headerShown: true, title: 'Spaces' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={process.env.EXPO_OS === 'ios' ? 'plus' : Add}
          accessibilityLabel="New space"
          onPress={() => router.push('/new-space')}
        />
      </Stack.Toolbar>
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
          contentContainerStyle={{
            padding: Spacing.three,
            paddingLeft: insets.left + Spacing.three,
            paddingRight: insets.right + Spacing.three,
            gap: Spacing.three,
            flexGrow: 1,
          }}
          columnWrapperStyle={columns > 1 ? { gap: Spacing.three } : undefined}
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
              {/* Link asChild drops a function `style`, so the pressed state is
                  applied to an inner View instead of the Pressable. */}
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
  card: {
    height: 130,
    borderRadius: Radius.large,
    padding: Spacing.three,
    justifyContent: 'flex-end',
  },
  cardTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: 700 },
});
