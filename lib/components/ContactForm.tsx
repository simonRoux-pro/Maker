import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, PrimaryButton } from './ui';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../data/categories';
import { colors, radius, spacing } from '../theme';
import { Contact, ContactCategory } from '../types';

export interface ContactFormValue {
  name: string;
  category: ContactCategory;
  role: string;
  city: string;
  notes: string;
  phone: string;
  email: string;
}

export function ContactForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<ContactFormValue>;
  submitLabel: string;
  onSubmit: (value: ContactFormValue) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<ContactCategory>(initial?.category ?? 'militant');
  const [role, setRole] = useState(initial?.role ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');

  const canSubmit = name.trim().length > 0;

  return (
    <View style={{ gap: spacing.md }}>
      <Field label="Nom" value={name} onChangeText={setName} placeholder="Nom du contact" />

      <View style={{ gap: spacing.sm }}>
        <Body muted>Catégorie</Body>
        <View style={styles.row}>
          {CATEGORY_ORDER.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.choice, category === cat && styles.choiceSelected]}
            >
              <Text style={[styles.choiceText, category === cat && styles.choiceTextSelected]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Field label="Rôle / fonction" value={role} onChangeText={setRole} placeholder="Ex : secrétaire de section" />
      <Field label="Ville" value={city} onChangeText={setCity} placeholder="Ville" />
      <Field label="Téléphone" value={phone} onChangeText={setPhone} placeholder="Téléphone" keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Contexte, historique, prochaine étape..." multiline />

      <PrimaryButton
        label={submitLabel}
        disabled={!canSubmit}
        onPress={() =>
          onSubmit({
            name: name.trim(),
            category,
            role: role.trim(),
            city: city.trim(),
            notes: notes.trim(),
            phone: phone.trim(),
            email: email.trim(),
          })
        }
      />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'phone-pad' | 'email-address';
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Body muted>{label}</Body>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.inputMultiline]}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export function contactFromForm(id: string, existing: Contact | undefined, value: ContactFormValue): Contact {
  return {
    id,
    name: value.name,
    category: value.category,
    role: value.role,
    city: value.city,
    notes: value.notes,
    phone: value.phone,
    email: value.email,
    lastContactAt: existing?.lastContactAt ?? null,
    nextFollowUpAt: existing?.nextFollowUpAt ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

const styles = StyleSheet.create({
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
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm - 2,
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
    fontSize: 13,
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: colors.text,
  },
});
