import Checklist from '@expo/material-symbols/checklist.xml';
import CenterFocusStrong from '@expo/material-symbols/center_focus_strong.xml';
import Draw from '@expo/material-symbols/draw.xml';
import EditOff from '@expo/material-symbols/edit_off.xml';
import Image from '@expo/material-symbols/image.xml';
import Palette from '@expo/material-symbols/palette.xml';
import SpaceDashboard from '@expo/material-symbols/space_dashboard.xml';
import StickyNote from '@expo/material-symbols/sticky_note_2.xml';
import Undo from '@expo/material-symbols/undo.xml';
import { Stack } from 'expo-router/stack';

import { useTheme } from '@/hooks/use-theme';
import { DrawColors } from './drawing';

type Props = {
  onAddNote: () => void;
  onAddTodo: () => void;
  onAddSpace: () => void;
  onAddImage: () => void;
  onResetView: () => void;
  /** Whether Draw mode is on. */
  drawing: boolean;
  onToggleDraw: () => void;
  drawColor: string;
  onPickDrawColor: (color: string) => void;
  /** Removes the most recent stroke of this drawing session, when there is one. */
  onUndoStroke?: () => void;
};

// Metro replaces `process.env.EXPO_OS` at build time, so each platform only
// bundles its own icon set: SF Symbols on iOS, Material Symbols on Android.
const ios = process.env.EXPO_OS === 'ios';
const Icons = {
  note: ios ? 'note.text' : StickyNote,
  todo: ios ? 'checklist' : Checklist,
  space: ios ? 'plus.square.on.square' : SpaceDashboard,
  image: ios ? 'photo' : Image,
  draw: ios ? 'pencil.tip' : Draw,
  stopDrawing: ios ? 'pencil.tip' : EditOff,
  centre: ios ? 'scope' : CenterFocusStrong,
  palette: ios ? 'paintpalette' : Palette,
  undo: ios ? 'arrow.uturn.backward' : Undo,
} as const;

/** Names for `DrawColors`, in the same order, for the pen colour menu. */
const DrawColorNames = ['Purple', 'Green', 'Orange', 'Blue', 'Pink'];

/**
 * The canvas tools, in the system bottom toolbar of the space screen.
 *
 * Being a native toolbar, the system places it: along the bottom on phones and
 * Android, and in the vertical rail on a folded or landscape iPhone Duo. Every
 * item has an icon so it can move into that rail.
 *
 * Must be rendered by a screen (not a layout), which `Stack.Toolbar` requires
 * for the bottom placement.
 */
export function CanvasToolbar({
  onAddNote,
  onAddTodo,
  onAddSpace,
  onAddImage,
  onResetView,
  drawing,
  onToggleDraw,
  drawColor,
  onPickDrawColor,
  onUndoStroke,
}: Props) {
  const theme = useTheme();
  return (
    <Stack.Toolbar placement="bottom">
      {/* Each button carries a text label: the system shows it when it moves an
          item into the overflow menu, which it does from the end of the list
          when the bar or rail runs out of room. The order is by importance. */}
      <Stack.Toolbar.Button icon={Icons.note} accessibilityLabel="Add Note" hidden={drawing} onPress={onAddNote}>
        Note
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Button icon={Icons.todo} accessibilityLabel="Add To-do" hidden={drawing} onPress={onAddTodo}>
        To-do
      </Stack.Toolbar.Button>
      {/* Draw mode swaps the add tools for the pen colour and Undo. */}
      <Stack.Toolbar.Menu
        icon={Icons.palette}
        title="Pen colour"
        accessibilityLabel="Pen colour"
        tintColor={drawColor}
        hidden={!drawing}>
        {DrawColors.map((color, index) => (
          <Stack.Toolbar.MenuAction key={color} isOn={color === drawColor} onPress={() => onPickDrawColor(color)}>
            {DrawColorNames[index]}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
      <Stack.Toolbar.Button
        icon={Icons.undo}
        accessibilityLabel="Undo last stroke"
        hidden={!drawing}
        disabled={onUndoStroke === undefined}
        onPress={onUndoStroke}>
        Undo
      </Stack.Toolbar.Button>
      {/* `selected` is iOS only, so Android shows the state with its icon and tint. */}
      <Stack.Toolbar.Button
        icon={drawing ? Icons.stopDrawing : Icons.draw}
        accessibilityLabel={drawing ? 'Stop drawing' : 'Draw'}
        selected={drawing}
        tintColor={drawing && !ios ? theme.accent : undefined}
        onPress={onToggleDraw}>
        {drawing ? 'Stop drawing' : 'Draw'}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Button icon={Icons.space} accessibilityLabel="Add Space" hidden={drawing} onPress={onAddSpace}>
        Space
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Button icon={Icons.image} accessibilityLabel="Add Image" hidden={drawing} onPress={onAddImage}>
        Image
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Button icon={Icons.centre} accessibilityLabel="Centre the canvas" onPress={onResetView}>
        Centre
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
