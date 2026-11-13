import { UserProfileView } from '@clerk/expo/native-components';
import { useConvexAuth } from 'convex/react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AboutFoldspacePage, YourFoldspacePage } from '@/components/profile/profile-pages';
import { useTheme } from '@/hooks/use-theme';

/**
 * Clerk's native profile (edit profile, manage account, security, sign out)
 * with Foldspace's own pages added as rows. Clerk keeps its own navigation
 * chrome, so the Account stack hides its header.
 *
 * Signing out is synced to the JS SDK, which hides the tabs and sends the
 * user back to the welcome screen.
 */
export default function AccountScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const theme = useTheme();

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!isAuthenticated) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <UserProfileView
        style={{ flex: 1 }}
        isDismissible={false}
        customPages={[
          {
            path: 'your-foldspace',
            label: 'Your Foldspace',
            icon: 'folder',
            placement: { type: 'sectionStart', section: 'profile' },
            content: <YourFoldspacePage />,
          },
          {
            path: 'about',
            label: 'About Foldspace',
            icon: 'info',
            placement: { type: 'before', row: 'signOut' },
            content: <AboutFoldspacePage />,
          },
        ]}
      />
    </View>
  );
}
