import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Card, PrimaryButton, ProgressBar, Screen, Subtitle, Title } from '../../lib/components/ui';
import { useAppState } from '../../lib/context/AppStateContext';
import { getStageById } from '../../lib/data/roadmap';
import { colors, radius, spacing } from '../../lib/theme';

export default function MilestoneDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stage = getStageById(id);
  const { progress, toggleAction, setCurrentStage } = useAppState();

  if (!stage) {
    return (
      <Screen>
        <Body>Étape introuvable.</Body>
      </Screen>
    );
  }

  const doneCount = stage.actions.filter((a) => progress.completedActionIds.includes(a.id)).length;
  const isCurrent = progress.currentStageId === stage.id;

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Title>{stage.title}</Title>
        <Body muted>{stage.timeframe}</Body>
        <Body>{stage.summary}</Body>
        <ProgressBar progress={stage.actions.length ? doneCount / stage.actions.length : 0} />
      </View>

      {!isCurrent && (
        <PrimaryButton label="Définir comme étape actuelle" onPress={() => setCurrentStage(stage.id)} />
      )}

      <View style={{ gap: spacing.sm }}>
        <Subtitle>Actions concrètes</Subtitle>
        {stage.actions.map((action) => {
          const done = progress.completedActionIds.includes(action.id);
          return (
            <Pressable key={action.id} onPress={() => toggleAction(action.id)}>
              <Card>
                <View style={styles.actionHeader}>
                  <View style={[styles.checkbox, done && styles.checkboxDone]}>
                    {done && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.actionLabel, done && styles.actionLabelDone]}>{action.label}</Text>
                </View>
                <Body muted>{action.detail}</Body>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm / 2,
    borderWidth: 2,
    borderColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.background,
    fontWeight: '800',
    fontSize: 13,
  },
  actionLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
    flex: 1,
  },
  actionLabelDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
