import { Stack } from 'expo-router/stack';

export default function AccountStack() {
  // Clerk's native profile draws its own navigation bar.
  return <Stack screenOptions={{ title: 'Account', headerShown: false }} />;
}
