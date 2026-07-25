import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Container
        style={styles.container}
        contentContainerStyle={scroll ? styles.scrollContent : undefined}
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.bodyMuted]}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function DangerButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.dangerButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.dangerButtonText}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export function Pill({ label, tone = 'default' }: { label: string; tone?: 'default' | 'accent' | 'success' }) {
  const toneStyle =
    tone === 'accent' ? styles.pillAccent : tone === 'success' ? styles.pillSuccess : styles.pillDefault;
  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  bodyMuted: {
    color: colors.textMuted,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  dangerButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerButtonText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillDefault: {
    backgroundColor: colors.surfaceAlt,
  },
  pillAccent: {
    backgroundColor: colors.accent,
  },
  pillSuccess: {
    backgroundColor: colors.success,
  },
  pillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
