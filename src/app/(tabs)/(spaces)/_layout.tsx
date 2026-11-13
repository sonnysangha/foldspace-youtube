import { useConvexAuth } from 'convex/react';
import { Stack } from 'expo-router/stack';

export default function WorkspaceStack() {
  const { isAuthenticated } = useConvexAuth();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Foldspace' }} />
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="space/[id]" options={{ title: '' }} />
        <Stack.Screen
          name="new-space"
          options={{
            title: 'New space',
            headerShown: false,
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            sheetAllowedDetents: [0.5],
          }}
        />
        <Stack.Screen
          name="item/[id]"
          options={{
            title: 'Edit',
            headerShown: false,
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            sheetAllowedDetents: [0.6, 1],
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}
