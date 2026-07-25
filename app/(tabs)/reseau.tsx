import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Card, Pill, Screen, Subtitle, Title } from '../../lib/components/ui';
import { useAppState } from '../../lib/context/AppStateContext';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../lib/data/categories';
import { spacing } from '../../lib/theme';
import { Contact, ContactCategory } from '../../lib/types';

export default function Reseau() {
  const router = useRouter();
  const { contacts } = useAppState();

  const grouped = useMemo(() => {
    const map = new Map<ContactCategory, Contact[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const c of contacts) {
      map.get(c.category)?.push(c);
    }
    return map;
  }, [contacts]);

  const needsFollowUp = contacts.filter(
    (c) => c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() <= Date.now()
  );

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Title>Ton réseau</Title>
        <Body muted>{contacts.length} contact(s) — construit et entretenu par toi.</Body>
      </View>

      <Pressable onPress={() => router.push('/contact/new')}>
        <Card>
          <Subtitle>+ Ajouter un contact</Subtitle>
        </Card>
      </Pressable>

      {needsFollowUp.length > 0 && (
        <Card>
          <Subtitle>À relancer</Subtitle>
          {needsFollowUp.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/contact/${c.id}`)}>
              <Body>• {c.name}</Body>
            </Pressable>
          ))}
        </Card>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped.get(cat) ?? [];
        if (list.length === 0) return null;
        return (
          <View key={cat} style={{ gap: spacing.sm }}>
            <Subtitle>{CATEGORY_LABELS[cat]}</Subtitle>
            {list.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/contact/${c.id}`)}>
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Subtitle>{c.name}</Subtitle>
                    <Pill label={CATEGORY_LABELS[c.category]} />
                  </View>
                  {c.role ? <Body muted>{c.role}</Body> : null}
                  {c.city ? <Body muted>{c.city}</Body> : null}
                </Card>
              </Pressable>
            ))}
          </View>
        );
      })}

      {contacts.length === 0 && (
        <Card>
          <Body muted>
            Aucun contact pour l'instant. Commence par les personnes que tu connais déjà :
            responsables de section, élus locaux, associations.
          </Body>
        </Card>
      )}
    </Screen>
  );
}
