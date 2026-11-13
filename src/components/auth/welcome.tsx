import { AuthView } from '@clerk/expo/native-components';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, SpaceColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Signed-out landing screen. Clerk's native AuthView handles the whole flow. */
export function Welcome() {
  const theme = useTheme();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.art}>
        {SpaceColors.slice(0, 4).map((color, index) => (
          <View
            key={color}
            style={[
              styles.artCard,
              {
                backgroundColor: color,
                transform: [{ rotate: `${(index - 1.5) * 7}deg` }, { scale: 1 - index * 0.14 }],
              },
            ]}
          />
        ))}
      </View>
      <ThemedText type="subtitle" style={styles.center}>
        Spaces inside spaces
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        Notes, to-dos and whole new canvases, nested as deep as you like. Build them by hand or let
        your AI agent do it for you.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsAuthOpen(true)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
        ]}>
        <ThemedText style={{ color: theme.onAccent, fontWeight: 700 }}>Sign in or sign up</ThemedText>
      </Pressable>

      <Modal
        animationType="slide"
        visible={isAuthOpen}
        presentationStyle="pageSheet"
        onRequestClose={() => setIsAuthOpen(false)}>
        <AuthView onDismiss={() => setIsAuthOpen(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: { textAlign: 'center', maxWidth: 420 },
  art: { width: 220, height: 170, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.three },
  artCard: { position: 'absolute', width: 200, height: 140, borderRadius: Radius.large },
  button: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    minHeight: 48,
    justifyContent: 'center',
  },
});
