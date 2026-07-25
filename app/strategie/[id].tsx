import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Body, Pill, Screen, Title } from '../../lib/components/ui';
import { getArticleById } from '../../lib/data/strategies';
import { spacing } from '../../lib/theme';

export default function StrategyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = getArticleById(id);

  if (!article) {
    return (
      <Screen>
        <Body>Article introuvable.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <Pill label={article.category} tone="accent" />
        <Title>{article.title}</Title>
        <Body muted>{article.readMinutes} min de lecture</Body>
      </View>
      <View style={{ gap: spacing.md }}>
        {article.body.map((paragraph, idx) => (
          <Body key={idx}>{paragraph}</Body>
        ))}
      </View>
    </Screen>
  );
}
