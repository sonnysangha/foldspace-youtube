import { useQuery } from 'convex/react';
import { Link } from 'expo-router';
import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ItemCard } from './cards';
import type { CanvasItem } from './types';

// The most recently touched items are the ones drawn, so a huge space still
// gives a cheap preview.
const MAX_PREVIEW_ITEMS = 60;
// A space with one small note should not blow that note up to fill the card.
const MAX_PREVIEW_SCALE = 0.6;
const PREVIEW_PADDING = 6;
const FACE_PADDING = Spacing.two;
const FACE_FOOTER = 30;

function noop() {}

type PreviewProps = { spaceId: Id<'spaces'>; width: number; height: number };

/**
 * A live miniature of a space's canvas: the same cards the canvas draws,
 * scaled down to fit. It subscribes to the space's items, so it updates as
 * the space changes, and opening the space afterwards starts from warm data.
 */
export function SpacePreview({ spaceId, width, height }: PreviewProps) {
  if (width <= 0 || height <= 0) return null;
  return (
    <PreviewBoundary key={spaceId}>
      <Miniature spaceId={spaceId} width={width} height={height} />
    </PreviewBoundary>
  );
}

function Miniature({ spaceId, width, height }: PreviewProps) {
  const theme = useTheme();
  const items = useQuery(api.items.list, { spaceId });

  if (items === undefined) return null;
  if (items.length === 0) {
    return (
      <View style={[styles.emptyPreview, { width, height }]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Empty</Text>
      </View>
    );
  }

  // Same stacking as the canvas: most recently touched on top.
  const shown = [...items].sort((a, b) => a.z - b.z).slice(-MAX_PREVIEW_ITEMS);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of shown) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const scale = Math.min(
    (width - PREVIEW_PADDING * 2) / contentWidth,
    (height - PREVIEW_PADDING * 2) / contentHeight,
    MAX_PREVIEW_SCALE,
  );

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, overflow: 'hidden' }}>
      <View
        style={[
          styles.miniature,
          {
            left: (width - contentWidth * scale) / 2,
            top: (height - contentHeight * scale) / 2,
            width: contentWidth,
            height: contentHeight,
            transform: [{ scale }],
          },
        ]}>
        {shown.map((item) => (
          <View key={item._id} style={[styles.miniatureItem, { left: item.x - minX, top: item.y - minY }]}>
            <ItemCard item={item} onOpen={noop} onToggleTask={noop} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A preview is decoration. If its query fails, the card still works without it. */
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type FaceProps = {
  spaceId: Id<'spaces'>;
  name: string;
  color: string;
  width: number;
  height: number;
  radius?: number;
};

/** The look of a space card: the space's colour framing a window onto its canvas. */
export function SpaceCardFace({ spaceId, name, color, width, height, radius = Radius.medium }: FaceProps) {
  const theme = useTheme();
  return (
    <View style={[styles.face, { width, height, borderRadius: radius, backgroundColor: color }]}>
      <View
        style={[
          styles.window,
          { borderRadius: Math.max(4, radius - FACE_PADDING), backgroundColor: theme.canvas },
        ]}>
        <SpacePreview
          spaceId={spaceId}
          width={width - FACE_PADDING * 2}
          height={height - FACE_PADDING * 2 - FACE_FOOTER}
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
}

/**
 * A nested space on the canvas. Tapping it opens the space, and on iOS 18+
 * the card zooms into the screen it opens.
 */
export function SpaceItemCard({ item }: { item: CanvasItem }) {
  if (item.content.kind !== 'space') return null;
  const name = item.child?.name ?? 'Space';
  return (
    <Link href={{ pathname: '/space/[id]', params: { id: item.content.childSpaceId } }} asChild>
      <Link.AppleZoom>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open nested space ${name}`}
          style={styles.itemCard}>
          <SpaceCardFace
            spaceId={item.content.childSpaceId}
            name={name}
            color={item.child?.color ?? '#6C5CE7'}
            width={item.width}
            height={item.height}
          />
        </Pressable>
      </Link.AppleZoom>
    </Link>
  );
}

const styles = StyleSheet.create({
  emptyPreview: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 12, opacity: 0.7 },
  // Scaled from the top-left corner so `left` and `top` place it exactly.
  miniature: { position: 'absolute', transformOrigin: 'top left' },
  miniatureItem: { position: 'absolute' },
  face: { padding: FACE_PADDING, overflow: 'hidden' },
  window: { flex: 1, overflow: 'hidden' },
  footer: { height: FACE_FOOTER, justifyContent: 'flex-end', paddingHorizontal: Spacing.one },
  name: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  itemCard: { borderRadius: Radius.medium, boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)' },
});
