import { useConvexAuth } from 'convex/react';
import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';

/** Native tabs stay in the system tab bar/rail; there is no sidebar panel. */
export function WorkspaceNavigation() {
  const { isAuthenticated } = useConvexAuth();
  const theme = useTheme();

  return (
    <NativeTabs hidden={!isAuthenticated} preferredPlacement="tabBar" sidebarAdaptable={false} tintColor={theme.accent}>
      <NativeTabs.Trigger name="(spaces)" disablePopToTop>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label>Spaces</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
