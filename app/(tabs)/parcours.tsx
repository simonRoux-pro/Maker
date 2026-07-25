import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Card, Pill, ProgressBar, Screen, Subtitle, Title } from '../../lib/components/ui';
import { ROADMAP_STAGES, getAllActionIds } from '../../lib/data/roadmap';
import { useAppState } from '../../lib/context/AppStateContext';
import { colors, spacing } from '../../lib/theme';

export default function Parcours() {
  const router = useRouter();
  const { progress, profile } = useAppState();

  const totalActions = getAllActionIds().length;
  const doneActions = progress.completedActionIds.length;
  const overallProgress = totalActions > 0 ? doneActions / totalActions : 0;

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Title>{profile.firstName ? `Le parcours de ${profile.firstName}` : 'Ton parcours'}</Title>
        <Body muted>
          {doneActions} / {totalActions} actions faites — avance étape par étape.
        </Body>
        <ProgressBar progress={overallProgress} />
      </View>

      {ROADMAP_STAGES.map((stage) => {
        const stageActionIds = stage.actions.map((a) => a.id);
        const stageDone = stageActionIds.filter((id) => progress.completedActionIds.includes(id)).length;
        const isCurrent = progress.currentStageId === stage.id;
        const isComplete = stageDone === stageActionIds.length;

        return (
          <Pressable key={stage.id} onPress={() => router.push(`/milestone/${stage.id}`)}>
            <Card style={isCurrent ? styles.currentCard : undefined}>
              <View style={styles.headerRow}>
                <Subtitle>
                  {stage.order}. {stage.title}
                </Subtitle>
                {isComplete ? (
                  <Pill label="Complété" tone="success" />
                ) : isCurrent ? (
                  <Pill label="En cours" tone="accent" />
                ) : null}
              </View>
              <Body muted>{stage.timeframe}</Body>
              <Body>{stage.summary}</Body>
              <ProgressBar progress={stageActionIds.length ? stageDone / stageActionIds.length : 0} />
              <Body muted>
                {stageDone} / {stageActionIds.length} actions
              </Body>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentCard: {
    borderColor: colors.accent,
  },
});
