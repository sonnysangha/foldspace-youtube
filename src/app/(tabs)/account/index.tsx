import { useClerk, useUser } from '@clerk/expo';
import { UserButton } from '@clerk/expo/native-components';
import { Button, Host } from '@expo/ui';
import { useConvexAuth } from 'convex/react';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AccountScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const theme = useTheme();

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      Alert.alert('Could not sign out', 'Please try again.');
      setSigningOut(false);
    }
  }
  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!isAuthenticated) return <Redirect href="/" />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }}>
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.content}>
        <View style={styles.profile}>
          <UserButton />
          <View style={{ flex: 1, gap: Spacing.one }}>
            <ThemedText type="subtitle">{user?.fullName || 'Your account'}</ThemedText>
            <ThemedText themeColor="textSecondary">{user?.primaryEmailAddress?.emailAddress}</ThemedText>
          </View>
        </View>
        <ThemedText themeColor="textSecondary">Open your profile to manage your account.</ThemedText>
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <Button
            label={signingOut ? 'Signing out…' : 'Sign out'}
            variant="outlined"
            disabled={signingOut}
            onPress={() => void handleSignOut()}
            style={{ width: '100%', height: 48 }}
          />
        </Host>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
