import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Body, Card, Pill, Screen, Subtitle, Title } from '../../lib/components/ui';
import { STRATEGY_ARTICLES } from '../../lib/data/strategies';
import { spacing } from '../../lib/theme';

export default function Strategies() {
  const router = useRouter();

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Title>Repères stratégiques</Title>
        <Body muted>Fonctionnement des institutions, réseautage, cadre légal.</Body>
      </View>

      {STRATEGY_ARTICLES.map((article) => (
        <Pressable key={article.id} onPress={() => router.push(`/strategie/${article.id}`)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Subtitle>{article.title}</Subtitle>
              <Pill label={`${article.readMinutes} min`} />
            </View>
            <Pill label={article.category} tone="accent" />
            <Body muted>{article.summary}</Body>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
