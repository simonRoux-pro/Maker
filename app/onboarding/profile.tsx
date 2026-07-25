import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, PrimaryButton, Title } from '../../lib/components/ui';
import { useAppState } from '../../lib/context/AppStateContext';
import { colors, radius, spacing } from '../../lib/theme';
import { City, Situation } from '../../lib/types';

const CITIES: { id: City; label: string }[] = [
  { id: 'saint-etienne', label: 'Saint-Étienne' },
  { id: 'lyon', label: 'Lyon' },
];

const SITUATIONS: { id: Situation; label: string }[] = [
  { id: 'sympathisant', label: 'Sympathisant, pas encore adhérent' },
  { id: 'adherent', label: 'Adhérent à un parti' },
  { id: 'militant-actif', label: 'Militant actif' },
  { id: 'responsable-local', label: 'Responsable local' },
  { id: 'elu-local', label: 'Déjà élu local' },
];

export default function ProfileStep() {
  const router = useRouter();
  const { profile, setProfile } = useAppState();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [city, setCity] = useState<City | null>(profile.city);
  const [situation, setSituation] = useState<Situation | null>(profile.situation);
  const [party, setParty] = useState(profile.party ?? '');

  const canContinue = firstName.trim().length > 0 && city !== null && situation !== null;

  const onContinue = async () => {
    await setProfile({
      firstName: firstName.trim(),
      city,
      situation,
      party: party.trim() || null,
      onboardedAt: profile.onboardedAt,
    });
    router.push('/onboarding/permissions');
  };

  return (
    <View style={styles.container}>
      <View style={{ gap: spacing.lg }}>
        <Title>Ton point de départ</Title>

        <View style={{ gap: spacing.sm }}>
          <Body muted>Prénom</Body>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Prénom"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Body muted>Ville de référence</Body>
          <View style={styles.row}>
            {CITIES.map((c) => (
              <Choice key={c.id} label={c.label} selected={city === c.id} onPress={() => setCity(c.id)} />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Body muted>Où en es-tu aujourd'hui ?</Body>
          <View style={{ gap: spacing.sm }}>
            {SITUATIONS.map((s) => (
              <Choice
                key={s.id}
                label={s.label}
                selected={situation === s.id}
                onPress={() => setSituation(s.id)}
                fullWidth
              />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Body muted>Parti ou mouvement (optionnel)</Body>
          <TextInput
            value={party}
            onChangeText={setParty}
            placeholder="Nom du parti si déjà choisi"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>
      </View>

      <PrimaryButton label="Continuer" onPress={onContinue} disabled={!canContinue} />
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
  fullWidth,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected, fullWidth && { width: '100%' }]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choice: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
  },
  choiceText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: colors.text,
  },
});
