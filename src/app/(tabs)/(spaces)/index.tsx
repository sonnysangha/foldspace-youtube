import { useConvexAuth, useQuery } from 'convex/react';
import { Link, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Welcome } from '@/components/auth/welcome';
import { SpaceCardFace } from '@/components/canvas/space-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../../../convex/_generated/api';

const CARD_HEIGHT = 170;

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
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Spaces',
          headerRight: Platform.OS === 'ios' ? undefined : () => (
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
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button icon="plus" accessibilityLabel="New space" onPress={() => router.push('/new-space')} />
        </Stack.Toolbar>
      ) : null}
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
              {/* On iOS 18+ the card zooms into the space it opens. */}
              <Link.AppleZoom>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open space ${item.name}`}
                  style={{ width: cardWidth }}>
                  {({ pressed }) => (
                    <View style={{ transform: [{ scale: pressed ? 0.97 : 1 }] }}>
                      <SpaceCardFace
                        spaceId={item._id}
                        name={item.name}
                        color={item.color}
                        width={cardWidth}
                        height={CARD_HEIGHT}
                        radius={Radius.large}
                      />
                    </View>
                  )}
                </Pressable>
              </Link.AppleZoom>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
});
