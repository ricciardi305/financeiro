import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Chips, Text } from "./form";
import { colors, spacing } from "./theme";

type Option = { value: string; label: string };

/** Bottom sheet with the list filters, so the list itself starts right below the month picker. */
export function FilterSheet(props: {
  visible: boolean;
  onClose: () => void;
  accountOptions: Option[];
  categoryOptions: Option[];
  accountId: string;
  categoryId: string;
  onAccount: (v: string) => void;
  onCategory: (v: string) => void;
  onClear: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={props.onClose} />
      <View
        style={{
          maxHeight: "80%",
          backgroundColor: colors.surface,
          borderTopLeftRadius: spacing.lg,
          borderTopRightRadius: spacing.lg,
          borderTopWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600", padding: spacing.lg }}>Filtros</Text>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <Chips label="Conta" options={props.accountOptions} value={props.accountId} onChange={props.onAccount} />
          <Chips label="Categoria" options={props.categoryOptions} value={props.categoryId} onChange={props.onCategory} />
        </ScrollView>
        <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom }}>
          <View style={{ flex: 1 }}>
            <Button secondary title="Limpar" onPress={props.onClear} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Concluído" onPress={props.onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
