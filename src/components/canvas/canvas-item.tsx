import { type ReactNode, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type Props = {
  x: number;
  y: number;
  z: number;
  /** The canvas zoom, so a finger drag moves the item 1:1 on screen. */
  canvasScale: SharedValue<number>;
  onMoveEnd: (x: number, y: number) => void;
  children: ReactNode;
};

/** Positions a card on the canvas and lets the user drag it around. */
export function CanvasItemView({ x, y, z, canvasScale, onMoveEnd, children }: Props) {
  const px = useSharedValue(x);
  const py = useSharedValue(y);
  const startX = useSharedValue(x);
  const startY = useSharedValue(y);
  const lift = useSharedValue(1);

  // Follow the database when the position changes elsewhere (another device,
  // or an AI agent moving things through the MCP server).
  useEffect(() => {
    px.set(x);
    py.set(y);
  }, [x, y, px, py]);

  const drag = usePanGesture({
    maxPointers: 1,
    onActivate: () => {
      'worklet';
      startX.set(px.get());
      startY.set(py.get());
      lift.set(withSpring(1.04, { duration: 200, dampingRatio: 1 }));
    },
    onUpdate: (event) => {
      'worklet';
      px.set(startX.get() + event.translationX / canvasScale.get());
      py.set(startY.get() + event.translationY / canvasScale.get());
    },
    onDeactivate: () => {
      'worklet';
      lift.set(withSpring(1, { duration: 300, dampingRatio: 0.8 }));
      scheduleOnRN(onMoveEnd, Math.round(px.get()), Math.round(py.get()));
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: px.get() }, { translateY: py.get() }, { scale: lift.get() }],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[styles.item, { zIndex: z }, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  item: { position: 'absolute', left: 0, top: 0 },
});
