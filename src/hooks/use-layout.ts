import { useWindowDimensions } from 'react-native';

import { WideBreakpoint } from '@/constants/theme';

/**
 * Layout decisions come from the live window size, so the UI adapts when a
 * foldable opens or closes, a tablet rotates, or the app is put in split view.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  return { width, height, isWide: width >= WideBreakpoint };
}
