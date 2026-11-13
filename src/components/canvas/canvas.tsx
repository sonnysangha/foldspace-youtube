import { useImperativeHandle, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { CanvasItemView } from './canvas-item';
import { ItemCard } from './cards';
import type { CanvasItem } from './types';

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const GRID_EXTENT = 2400;
const GRID_STEP = 28;

export type CanvasHandle = {
  /** Canvas coordinates of the middle of the visible area. */
  getCenter: () => { x: number; y: number };
  resetView: () => void;
};

type Props = {
  ref?: Ref<CanvasHandle>;
  items: CanvasItem[];
  width: number;
  height: number;
  onMoveItem: (item: CanvasItem, x: number, y: number) => void;
  onOpenItem: (item: CanvasItem) => void;
  onToggleTask: (item: CanvasItem, taskId: string) => void;
};

/**
 * A pannable, zoomable surface. One finger on the background pans, two
 * fingers pinch to zoom around the point between them, and dragging a card
 * moves just that card. All of it runs on the UI thread.
 */
export function Canvas({ ref, items, width, height, onMoveItem, onOpenItem, onToggleTask }: Props) {
  const theme = useTheme();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  useImperativeHandle(ref, () => ({
    getCenter: () => ({
      x: (width / 2 - tx.get()) / scale.get(),
      y: (height / 2 - ty.get()) / scale.get(),
    }),
    resetView: () => {
      const spring = { duration: 400, dampingRatio: 1 };
      tx.set(withSpring(0, spring));
      ty.set(withSpring(0, spring));
      scale.set(withSpring(1, spring));
    },
  }));

  const pan = usePanGesture({
    maxPointers: 2,
    onUpdate: (event) => {
      'worklet';
      tx.set(tx.get() + event.changeX);
      ty.set(ty.get() + event.changeY);
    },
  });

  const pinch = usePinchGesture({
    onUpdate: (event) => {
      'worklet';
      const current = scale.get();
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * event.scaleChange));
      const ratio = next / current;
      // Keep the point under the fingers fixed while zooming.
      tx.set(event.focalX - (event.focalX - tx.get()) * ratio);
      ty.set(event.focalY - (event.focalY - ty.get()) * ratio);
      scale.set(next);
    },
  });

  const gesture = useSimultaneousGestures(pan, pinch);

  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.viewport, { backgroundColor: theme.canvas }]} collapsable={false}>
        <Animated.View style={[styles.world, worldStyle]}>
          <Svg
            pointerEvents="none"
            width={GRID_EXTENT}
            height={GRID_EXTENT}
            style={{ position: 'absolute', left: -GRID_EXTENT / 2, top: -GRID_EXTENT / 2 }}>
            <Defs>
              <Pattern id="dots" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                <Circle cx={2} cy={2} r={1.6} fill={theme.canvasDot} />
              </Pattern>
            </Defs>
            <Rect width={GRID_EXTENT} height={GRID_EXTENT} fill="url(#dots)" />
          </Svg>
          {items.map((item) => (
            <CanvasItemView
              key={item._id}
              x={item.x}
              y={item.y}
              z={item.z}
              canvasScale={scale}
              onMoveEnd={(x, y) => onMoveItem(item, x, y)}>
              <ItemCard
                item={item}
                onOpen={() => onOpenItem(item)}
                onToggleTask={(taskId) => onToggleTask(item, taskId)}
              />
            </CanvasItemView>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  // Scale from the top-left corner so screen = canvas * scale + translation.
  world: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, transformOrigin: 'top left' },
});
