import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Body, DangerButton, Screen, SecondaryButton } from '../../lib/components/ui';
import { ContactForm, contactFromForm } from '../../lib/components/ContactForm';
import { useAppState } from '../../lib/context/AppStateContext';

export default function ContactDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { contacts, updateContact, removeContact } = useAppState();
  const contact = contacts.find((c) => c.id === id);

  if (!contact) {
    return (
      <Screen>
        <Body>Contact introuvable.</Body>
      </Screen>
    );
  }

  const markContactedToday = async () => {
    await updateContact({ ...contact, lastContactAt: new Date().toISOString() });
  };

  const confirmDelete = () => {
    Alert.alert('Supprimer ce contact ?', contact.name, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await removeContact(contact.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      {contact.lastContactAt && (
        <Body muted>Dernier contact : {new Date(contact.lastContactAt).toLocaleDateString('fr-FR')}</Body>
      )}

      <SecondaryButton label="Marquer comme contacté aujourd'hui" onPress={markContactedToday} />

      <ContactForm
        initial={contact}
        submitLabel="Enregistrer"
        onSubmit={async (value) => {
          await updateContact(contactFromForm(contact.id, contact, value));
          router.back();
        }}
      />

      <DangerButton label="Supprimer ce contact" onPress={confirmDelete} />
    </Screen>
  );
}
