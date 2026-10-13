import { Pressable, Text as RNText, type TextProps, TextInput, View } from "react-native";
import { centsFromTyped, formatInputCents } from "@/domain/money";
import { colors } from "./theme";

/** Drop-in for react-native's Text with the theme's text colour. */
export function Text({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[{ color: colors.text }, style]} />;
}

export function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "numeric" | "numbers-and-punctuation";
  editable?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontWeight: "600" }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        editable={props.editable ?? true}
        placeholder={props.placeholder}
        placeholderTextColor={colors.placeholder}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          borderRadius: 8,
          padding: 10,
          opacity: props.editable === false ? 0.5 : 1,
        }}
      />
    </View>
  );
}

/** Cents-first money input: digits only, "10" shows 0,10 and "1023" shows 10,23. */
export function MoneyField(props: {
  label: string;
  cents: number;
  onChangeCents: (c: number) => void;
  allowNegative?: boolean;
  editable?: boolean;
}) {
  return (
    <Field
      label={props.label}
      value={formatInputCents(props.cents)}
      onChangeText={(t) => props.onChangeCents(centsFromTyped(t, props.allowNegative))}
      keyboardType={props.allowNegative ? "numbers-and-punctuation" : "numeric"}
      editable={props.editable}
    />
  );
}

export function Chips<T extends string>(props: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  /** When set, tapping the selected chip again clears the choice. */
  onClear?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontWeight: "600" }}>{props.label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {props.options.map((o) => {
          const on = o.value === props.value;
          return (
            <Pressable
              key={o.value}
              disabled={props.disabled}
              onPress={() => (on && props.onClear ? props.onClear() : props.onChange(o.value))}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.border,
                backgroundColor: on ? colors.chipOn : colors.surface,
                opacity: props.disabled && !on ? 0.4 : 1,
              }}
            >
              <Text>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Button(props: { title: string; onPress: () => void; danger?: boolean; secondary?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        backgroundColor: props.danger ? colors.dangerBg : props.secondary ? colors.surface : colors.primary,
        borderWidth: props.secondary ? 1 : 0,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: props.danger ? colors.dangerText : colors.primaryText, fontWeight: "600" }}>
        {props.title}
      </Text>
    </Pressable>
  );
}
