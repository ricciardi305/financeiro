import { Pressable, Text as RNText, type TextProps, TextInput, View } from "react-native";
import { centsFromTyped, formatInputCents } from "@/domain/money";
import { colors, ripple, spacing, TAP } from "./theme";

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
  autoFocus?: boolean;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontWeight: "600" }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        editable={props.editable ?? true}
        placeholder={props.placeholder}
        placeholderTextColor={colors.placeholder}
        autoFocus={props.autoFocus}
        style={{
          minHeight: TAP,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          borderRadius: spacing.sm,
          paddingHorizontal: spacing.md,
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
  autoFocus?: boolean;
}) {
  return (
    <Field
      label={props.label}
      value={formatInputCents(props.cents)}
      onChangeText={(t) => props.onChangeCents(centsFromTyped(t, props.allowNegative))}
      keyboardType={props.allowNegative ? "numbers-and-punctuation" : "numeric"}
      editable={props.editable}
      autoFocus={props.autoFocus}
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
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontWeight: "600" }}>{props.label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {props.options.map((o) => {
          const on = o.value === props.value;
          return (
            <Pressable
              key={o.value}
              disabled={props.disabled}
              onPress={() => (on && props.onClear ? props.onClear() : props.onChange(o.value))}
              android_ripple={ripple}
              style={{
                minHeight: TAP,
                justifyContent: "center",
                paddingHorizontal: spacing.lg,
                borderRadius: TAP / 2,
                overflow: "hidden",
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
      android_ripple={ripple}
      style={{
        minHeight: TAP,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        borderRadius: spacing.sm,
        overflow: "hidden",
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

/** Empty list placeholder that always offers the next step. */
export function EmptyState(props: { message: string; actionTitle?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: "center", gap: spacing.lg, paddingVertical: spacing.xl }}>
      <Text style={{ color: colors.muted, textAlign: "center" }}>{props.message}</Text>
      {props.actionTitle && props.onAction && <Button title={props.actionTitle} onPress={props.onAction} />}
    </View>
  );
}

/** Round "+" for screen headers. */
export function HeaderAction(props: { symbol: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      android_ripple={{ ...ripple, borderless: true }}
      style={{ width: TAP, height: TAP, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 28, color: colors.primary }}>{props.symbol}</Text>
    </Pressable>
  );
}

/** Fixed bottom bar for a form's main action; stays above the keyboard and the system bar. */
export function FormFooter(props: { children: React.ReactNode; bottomInset: number }) {
  return (
    <View
      style={{
        padding: spacing.lg,
        paddingBottom: spacing.lg + props.bottomInset,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {props.children}
    </View>
  );
}
