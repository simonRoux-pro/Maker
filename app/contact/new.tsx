import { useRouter } from 'expo-router';
import { Screen } from '../../lib/components/ui';
import { ContactForm, contactFromForm } from '../../lib/components/ContactForm';
import { useAppState } from '../../lib/context/AppStateContext';
import { generateId } from '../../lib/id';

export default function NewContact() {
  const router = useRouter();
  const { addContact } = useAppState();

  return (
    <Screen>
      <ContactForm
        submitLabel="Ajouter"
        onSubmit={async (value) => {
          const contact = contactFromForm(generateId(), undefined, value);
          await addContact(contact);
          router.back();
        }}
      />
    </Screen>
  );
}
