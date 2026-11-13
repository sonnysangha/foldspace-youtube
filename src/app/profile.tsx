import { UserProfileView } from '@clerk/expo/native-components';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AboutFoldspacePage, YourFoldspacePage } from '@/components/profile/profile-pages';
import { useTheme } from '@/hooks/use-theme';

/**
 * Clerk's native profile (manage account, security, sign out) with Foldspace's
 * own pages added as rows. The route's header is hidden so Clerk's navigation
 * chrome takes over; `onHostBack` pops this route from its root screen.
 *
 * Signing out flips the `Stack.Protected` guard in the root layout, which
 * removes this route and lands the user on the welcome screen.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <UserProfileView
        style={{ flex: 1 }}
        isDismissible={false}
        onHostBack={() => router.back()}
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
