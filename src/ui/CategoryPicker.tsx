import { useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { errorMessage } from "@/domain/errors";
import { createCategory, listCategories } from "@/services/categories";
import { Button, Chips, Field, IconBadge, Text } from "./form";
import { colors, RADIUS, ripple, spacing } from "./theme";
import { toast } from "./toast";

const NEW = "__new__";
const SWATCHES = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899"];
const ICONS = [
  "shopping-bag", "coffee", "film", "music", "gift", "heart", "truck", "tool",
  "smartphone", "droplet", "umbrella", "award", "dollar-sign", "briefcase", "trending-up", "star",
];

/** Category chips with a trailing "+ Nova categoria" that creates one on the spot and selects it. */
export function CategoryPicker(props: {
  label: string;
  kind: "income" | "expense";
  value: string | undefined;
  onChange: (id: string) => void;
  onClear?: () => void;
}) {
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[6]);
  const [icon, setIcon] = useState(ICONS[0]);

  void version; // re-list after a creation
  const options = [
    ...listCategories(props.kind).map((c) => ({ value: c.id, label: c.name, color: c.color })),
    { value: NEW, label: "+ Nova categoria" },
  ];

  const save = () => {
    try {
      const id = createCategory({ name, kind: props.kind, icon, color });
      setVersion((v) => v + 1);
      setCreating(false);
      setName("");
      props.onChange(id);
      toast("Categoria criada");
    } catch (e) {
      Alert.alert("Não foi possível criar", errorMessage(e));
    }
  };

  return (
    <>
      <Chips
        label={props.label}
        options={options}
        value={props.value}
        onChange={(v) => (v === NEW ? setCreating(true) : props.onChange(v))}
        onClear={props.onClear}
      />
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable
          onPress={() => setCreating(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.lg }}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: colors.surface, borderRadius: RADIUS, padding: spacing.lg, gap: spacing.lg }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600" }}>
              Nova categoria de {props.kind === "income" ? "receita" : "despesa"}
            </Text>
            <Field label="Nome" value={name} onChangeText={setName} autoFocus />
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontWeight: "600" }}>Cor</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {SWATCHES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: c,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {c === color && <Feather name="check" size={18} color="#fff" />}
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontWeight: "600" }}>Ícone</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {ICONS.map((i) => (
                  <Pressable
                    key={i}
                    onPress={() => setIcon(i)}
                    android_ripple={{ ...ripple, borderless: true }}
                    style={{
                      borderRadius: 24,
                      borderWidth: 2,
                      borderColor: i === icon ? colors.primary : "transparent",
                    }}
                  >
                    <IconBadge icon={i} color={i === icon ? color : colors.muted} size={44} />
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button secondary title="Cancelar" onPress={() => setCreating(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Criar" onPress={save} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
