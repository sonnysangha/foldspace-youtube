import { useMutation, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Canvas, type CanvasHandle } from '@/components/canvas/canvas';
import { CanvasToolbar } from '@/components/canvas/toolbar';
import type { CanvasItem } from '@/components/canvas/types';
import { SpaceSidebar } from '@/components/space-sidebar';
import { ThemedText } from '@/components/themed-text';
import { NoteColors, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

export default function SpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = id as Id<'spaces'>;
  const theme = useTheme();
  const router = useRouter();
  const { isWide } = useLayout();
  // The header is translucent and floats over the canvas, so overlays start below it.
  const overlayTop = useSafeAreaInsets().top + 52;
  const canvasRef = useRef<CanvasHandle>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const found = useQuery(api.spaces.get, { spaceId });
  const items = useQuery(api.items.list, found ? { spaceId } : 'skip');
  const createItem = useMutation(api.items.create);
  const removeSpace = useMutation(api.spaces.remove);
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);
  const createImage = useMutation(api.items.createImage);
  const removeItem = useMutation(api.items.remove);
  const [uploading, setUploading] = useState(false);

  // Move the card in the local cache straight away so it never snaps back
  // while the server confirms the new position.
  const updateItem = useMutation(api.items.update).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.items.list, { spaceId });
    if (current === undefined) return;
    store.setQuery(
      api.items.list,
      { spaceId },
      current.map((item) =>
        item._id === args.itemId
          ? {
              ...item,
              x: args.x ?? item.x,
              y: args.y ?? item.y,
              content: args.content ?? item.content,
            }
          : item,
      ),
    );
  });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  }

  /** Top-left position that centres a new card of the given size in view. */
  function spot(width: number, height: number) {
    const center = canvasRef.current?.getCenter() ?? { x: 160, y: 200 };
    // Nudge each new card a little so several adds in a row do not stack exactly.
    const jitter = ((items?.length ?? 0) % 5) * 18;
    return { x: Math.round(center.x - width / 2 + jitter), y: Math.round(center.y - height / 2 + jitter) };
  }

  function openItem(item: CanvasItem) {
    if (item.content.kind === 'space') {
      router.push({ pathname: '/space/[id]', params: { id: item.content.childSpaceId } });
    } else if (item.content.kind === 'note' || item.content.kind === 'todo') {
      router.push({ pathname: '/item/[id]', params: { id: item._id } });
    } else if (item.content.kind === 'image') {
      Alert.alert('Image', undefined, [
        { text: 'Delete image', style: 'destructive', onPress: () => void removeItem({ itemId: item._id }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  /** Pick a photo, upload it to Convex file storage, then place it on the canvas. */
  async function addImage() {
    if (uploading) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    // Work out where the card goes before the upload, while the view is where the user left it.
    const longest = Math.max(asset.width, asset.height) || 260;
    const position = spot((asset.width / longest) * 260 || 260, (asset.height / longest) * 260 || 195);
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const file = await (await fetch(asset.uri)).blob();
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': asset.mimeType ?? 'image/jpeg' },
        body: file,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
      await createImage({
        spaceId,
        ...position,
        storageId,
        imageWidth: asset.width,
        imageHeight: asset.height,
      });
    } catch (error) {
      Alert.alert('Could not add the image', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function toggleTask(item: CanvasItem, taskId: string) {
    if (item.content.kind !== 'todo') return;
    void updateItem({
      itemId: item._id,
      content: {
        ...item.content,
        tasks: item.content.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
      },
    });
  }

  function confirmDelete() {
    Alert.alert('Delete this space?', 'Everything inside it, including nested spaces, will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeSpace({ spaceId });
          router.back();
        },
      },
    ]);
  }

  if (found === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (found === null) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.canvas }]}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <ThemedText>This space no longer exists.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: found.space.name,
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Delete space" hitSlop={12} onPress={confirmDelete}>
              <Text style={{ color: theme.danger, fontSize: 15, fontWeight: '600' }}>Delete</Text>
            </Pressable>
          ),
        }}
      />
      {isWide ? <SpaceSidebar activeId={spaceId} /> : null}
      <View style={styles.canvasPane} onLayout={onLayout}>
        <Canvas
          ref={canvasRef}
          items={items ?? []}
          width={canvasSize.width}
          height={canvasSize.height}
          onMoveItem={(item, x, y) => void updateItem({ itemId: item._id, x, y })}
          onOpenItem={openItem}
          onToggleTask={toggleTask}
        />

        {found.path.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.breadcrumbs, { top: overlayTop }]}
            contentContainerStyle={styles.breadcrumbsContent}>
            {found.path.map((crumb, index) => {
              const last = index === found.path.length - 1;
              return (
                <View key={crumb._id} style={styles.crumbRow}>
                  <Pressable
                    disabled={last}
                    accessibilityRole="button"
                    accessibilityLabel={`Go up to ${crumb.name}`}
                    hitSlop={8}
                    onPress={() => router.dismissTo({ pathname: '/space/[id]', params: { id: crumb._id } })}
                    style={[styles.crumb, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Text style={{ color: last ? theme.text : theme.accent, fontWeight: last ? '700' : '600', fontSize: 13 }}>
                      {crumb.name}
                    </Text>
                  </Pressable>
                  {last ? null : <Text style={{ color: theme.textSecondary }}>›</Text>}
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {items !== undefined && items.length === 0 ? (
          <View pointerEvents="none" style={styles.empty}>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
              This space is empty. Add a note, a to-do list, an image or a nested space below.
            </ThemedText>
          </View>
        ) : null}

        {uploading ? (
          <View
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            style={[styles.uploading, { top: overlayTop + 44, backgroundColor: theme.background, borderColor: theme.border }]}>
            <ActivityIndicator size="small" />
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>Uploading image…</Text>
          </View>
        ) : null}

        <CanvasToolbar
          onAddNote={() =>
            void createItem({
              spaceId,
              ...spot(220, 180),
              content: {
                kind: 'note',
                text: '',
                color: NoteColors[(items?.length ?? 0) % NoteColors.length],
              },
            })
          }
          onAddTodo={() =>
            void createItem({ spaceId, ...spot(250, 230), content: { kind: 'todo', title: 'To-do', tasks: [] } })
          }
          onAddSpace={() => {
            const position = spot(210, 150);
            router.push({
              pathname: '/new-space',
              params: { parentId: spaceId, x: String(position.x), y: String(position.y) },
            });
          }}
          onAddImage={() => void addImage()}
          onResetView={() => canvasRef.current?.resetView()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row' },
  canvasPane: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  breadcrumbs: { position: 'absolute', left: 0, right: 0, flexGrow: 0 },
  breadcrumbsContent: { paddingHorizontal: Spacing.three, alignItems: 'center', gap: Spacing.one },
  crumbRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  crumb: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  uploading: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: { position: 'absolute', left: Spacing.five, right: Spacing.five, top: '40%' },
});
