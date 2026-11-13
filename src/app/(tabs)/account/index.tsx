import { useUser } from '@clerk/expo';
import { UserButton } from '@clerk/expo/native-components';
import { useConvexAuth } from 'convex/react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AccountScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const theme = useTheme();
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
        <ThemedText themeColor="textSecondary">Open your profile to manage your account or sign out.</ThemedText>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
