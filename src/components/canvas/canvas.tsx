import { useImperativeHandle, type Ref } from 'react';
import { PixelRatio, Platform, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/hooks/use-theme';
import { CanvasItemView } from './canvas-item';
import { ItemCard } from './cards';
import { SpaceItemCard } from './space-card';
import { type Stroke, toStroke } from './drawing';
import type { CanvasItem } from './types';

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
// A pinch-in counts as "go up a level" only when it is quick: it has to reach
// this speed (scale factor per second) and actually close the fingers this far.
// A slow pinch never reaches the speed, so it stays an ordinary zoom.
const FAST_PINCH_VELOCITY = 2.5;
const FAST_PINCH_MAX_SCALE = 0.85;
const GRID_EXTENT = 2400;
const GRID_STEP = 28;
// Screen distance a finger must move before another point is recorded.
const MIN_POINT_GAP = 2;
// Keeps one stroke inside what a single Convex document can hold.
const MAX_STROKE_VALUES = 8000;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type Pen = { color: string; strokeWidth: number };

// react-native-svg rasterises the whole grid into one bitmap on Android, and
// Android refuses to draw a bitmap over 100 MB. At full resolution the grid is
// 2400dp x pixel ratio per side, which crashes on dense screens (2.6x and up).
// So on Android the grid is rendered at no more than this many pixels per side
// and scaled back up, which keeps it near 30 MB on every device.
const GRID_MAX_PIXELS = 2800;
const GRID_DOWNSCALE =
  Platform.OS === 'android' ? Math.max(1, (GRID_EXTENT * PixelRatio.get()) / GRID_MAX_PIXELS) : 1;

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
  /** Set while Draw mode is on. One finger then draws instead of panning. */
  pen?: Pen | null;
  onDrawStroke?: (stroke: Stroke) => void;
  /** Called after a quick pinch-in, the gesture for leaving this canvas. */
  onPinchOut?: () => void;
};

/**
 * A pannable, zoomable surface. One finger on the background pans, two
 * fingers pinch to zoom around the point between them, and dragging a card
 * moves just that card. All of it runs on the UI thread. A quick pinch-in
 * reports `onPinchOut` instead of settling at the smaller zoom.
 *
 * In Draw mode one finger draws a stroke instead, and two fingers still pan
 * and zoom.
 */
export function Canvas({
  ref,
  items,
  width,
  height,
  onMoveItem,
  onOpenItem,
  onToggleTask,
  pen = null,
  onDrawStroke,
  onPinchOut,
}: Props) {
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

  const drawing = pen !== null;
  const strokeWidth = pen?.strokeWidth ?? 0;

  const pan = usePanGesture({
    minPointers: drawing ? 2 : 1,
    maxPointers: 2,
    onUpdate: (event) => {
      'worklet';
      tx.set(tx.get() + event.changeX);
      ty.set(ty.get() + event.changeY);
    },
  });

  // What the pinch in progress has done so far: how far the fingers have
  // closed, and the fastest they closed.
  const pinchScale = useSharedValue(1);
  const pinchPeakInward = useSharedValue(0);
  // The view before the pinch, to put back when the pinch means "leave".
  const pinchStart = useSharedValue({ tx: 0, ty: 0, scale: 1 });

  function leave() {
    onPinchOut?.();
  }

  const pinch = usePinchGesture({
    onActivate: () => {
      'worklet';
      pinchScale.set(1);
      pinchPeakInward.set(0);
      pinchStart.set({ tx: tx.get(), ty: ty.get(), scale: scale.get() });
    },
    onUpdate: (event) => {
      'worklet';
      pinchScale.set(event.scale);
      if (event.velocity < pinchPeakInward.get()) pinchPeakInward.set(event.velocity);
      const current = scale.get();
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * event.scaleChange));
      const ratio = next / current;
      // Keep the point under the fingers fixed while zooming.
      tx.set(event.focalX - (event.focalX - tx.get()) * ratio);
      ty.set(event.focalY - (event.focalY - ty.get()) * ratio);
      scale.set(next);
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled) return;
      if (pinchScale.get() > FAST_PINCH_MAX_SCALE || pinchPeakInward.get() > -FAST_PINCH_VELOCITY) return;
      // The pinch was a command, not a zoom, so undo the zoom it caused.
      const start = pinchStart.get();
      const spring = { duration: 300, dampingRatio: 1 };
      tx.set(withSpring(start.tx, spring));
      ty.set(withSpring(start.ty, spring));
      scale.set(withSpring(start.scale, spring));
      scheduleOnRN(leave);
    },
  });

  const gesture = useSimultaneousGestures(pan, pinch);

  // The stroke in progress: an SVG path in screen coordinates for display,
  // and the same points in canvas coordinates for saving.
  const livePath = useSharedValue('');
  const livePoints = useSharedValue<number[]>([]);
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);

  function finishStroke(canvasPoints: number[]) {
    const stroke = toStroke(canvasPoints, strokeWidth);
    if (stroke !== null) onDrawStroke?.(stroke);
    // Cleared after saving so the saved stroke takes over without a gap.
    livePath.set('');
  }

  const draw = usePanGesture({
    enabled: drawing,
    maxPointers: 1,
    minDistance: MIN_POINT_GAP,
    onBegin: (event) => {
      'worklet';
      // Start from where the finger landed, not where the pan activated.
      lastX.set(event.x);
      lastY.set(event.y);
      livePath.set(`M${event.x.toFixed(1)} ${event.y.toFixed(1)}`);
      livePoints.set([(event.x - tx.get()) / scale.get(), (event.y - ty.get()) / scale.get()]);
    },
    onUpdate: (event) => {
      'worklet';
      if (Math.hypot(event.x - lastX.get(), event.y - lastY.get()) < MIN_POINT_GAP) return;
      if (livePoints.get().length >= MAX_STROKE_VALUES) return;
      lastX.set(event.x);
      lastY.set(event.y);
      livePath.set(`${livePath.get()}L${event.x.toFixed(1)} ${event.y.toFixed(1)}`);
      const x = (event.x - tx.get()) / scale.get();
      const y = (event.y - ty.get()) / scale.get();
      livePoints.modify((points) => {
        'worklet';
        points.push(x, y);
        return points;
      });
    },
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(finishStroke, livePoints.get());
    },
    onFinalize: () => {
      'worklet';
      // A tap, or a second finger landing before any movement.
      if (livePoints.get().length < 4) livePath.set('');
    },
  });

  const livePathProps = useAnimatedProps(() => ({
    d: livePath.get() || 'M0 0',
    strokeWidth: strokeWidth * scale.get(),
  }));

  // item.z is a timestamp (last touched). Native zIndex needs small integers,
  // so stack by rank instead: most recently touched on top.
  const ordered = [...items].sort((a, b) => a.z - b.z);

  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.viewport, { backgroundColor: theme.canvas }]} collapsable={false}>
        <Animated.View style={[styles.world, worldStyle]}>
          <Svg
            pointerEvents="none"
            width={GRID_EXTENT / GRID_DOWNSCALE}
            height={GRID_EXTENT / GRID_DOWNSCALE}
            viewBox={`0 0 ${GRID_EXTENT} ${GRID_EXTENT}`}
            style={styles.grid}>
            <Defs>
              <Pattern id="dots" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                <Circle cx={2} cy={2} r={1.6} fill={theme.canvasDot} />
              </Pattern>
            </Defs>
            <Rect width={GRID_EXTENT} height={GRID_EXTENT} fill="url(#dots)" />
          </Svg>
          {ordered.map((item, index) => (
            <CanvasItemView
              key={item._id}
              x={item.x}
              y={item.y}
              z={index + 1}
              canvasScale={scale}
              onMoveEnd={(x, y) => onMoveItem(item, x, y)}>
              {item.content.kind === 'space' ? (
                <SpaceItemCard item={item} />
              ) : (
                <ItemCard
                  item={item}
                  onOpen={() => onOpenItem(item)}
                  onToggleTask={(taskId) => onToggleTask(item, taskId)}
                />
              )}
            </CanvasItemView>
          ))}
        </Animated.View>
        {pen !== null ? (
          // Sits above the cards so a stroke can cross them without dragging them.
          <GestureDetector gesture={draw}>
            <View style={StyleSheet.absoluteFill} collapsable={false}>
              <Svg pointerEvents="none" width={width} height={height}>
                <AnimatedPath
                  animatedProps={livePathProps}
                  stroke={pen.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>
          </GestureDetector>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  // Scale from the top-left corner so screen = canvas * scale + translation.
  grid: {
    position: 'absolute',
    left: -GRID_EXTENT / 2,
    top: -GRID_EXTENT / 2,
    transformOrigin: 'top left',
    transform: [{ scale: GRID_DOWNSCALE }],
  },
  world: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, transformOrigin: 'top left' },
});
