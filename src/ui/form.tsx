import { Feather } from "@expo/vector-icons";
import { Pressable, Text as RNText, type TextProps, TextInput, View, type ViewProps } from "react-native";
import { centsFromTyped, formatCents, formatInputCents } from "@/domain/money";
import { colors, RADIUS, ripple, spacing, TAP } from "./theme";

/** Drop-in for react-native's Text with the theme's text colour. */
export function Text({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[{ color: colors.text }, style]} />;
}

export function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "numeric" | "number-pad" | "numbers-and-punctuation";
  editable?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  selectTextOnFocus?: boolean;
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
        selectTextOnFocus={props.selectTextOnFocus}
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
      keyboardType={props.allowNegative ? "numbers-and-punctuation" : "number-pad"}
      editable={props.editable}
      autoFocus={props.autoFocus}
      selectTextOnFocus // typing replaces the shown value instead of appending to it
    />
  );
}

export function Chips<T extends string>(props: {
  label: string;
  options: { value: T; label: string; color?: string }[];
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
                borderColor: on ? (o.color ?? colors.primary) : colors.border,
                backgroundColor: on ? (o.color ? `${o.color}33` : colors.chipOn) : colors.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                opacity: props.disabled && !on ? 0.4 : 1,
              }}
            >
              {o.color && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: o.color }} />}
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

/** Borderless rounded card; `hero` lifts it one surface step for the key number of a screen. */
export function Card({ hero, style, ...rest }: ViewProps & { hero?: boolean }) {
  return (
    <View
      {...rest}
      style={[
        {
          padding: spacing.lg,
          borderRadius: RADIUS,
          backgroundColor: hero ? colors.surfaceHigh : colors.surface,
          gap: spacing.xs,
          overflow: "hidden",
        },
        style,
      ]}
    />
  );
}

/** Small uppercase-free eyebrow above a big number. */
export function Eyebrow({ children }: { children: string }) {
  return <Text style={{ color: colors.muted, fontSize: 13 }}>{children}</Text>;
}

/** Big headline number (balance, total). */
export function BigNumber({ cents, negativeRed = true }: { cents: number; negativeRed?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 34,
        fontWeight: "700",
        letterSpacing: -0.5,
        color: negativeRed && cents < 0 ? colors.expense : colors.text,
      }}
    >
      {formatCents(cents)}
    </Text>
  );
}

/** Round badge with a Feather icon on a tinted background (category / institution avatar). */
export function IconBadge(props: { icon: string; color: string; size?: number }) {
  const size = props.size ?? 40;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${props.color}33`,
      }}
    >
      <Feather name={props.icon as React.ComponentProps<typeof Feather>["name"]} size={size * 0.5} color={props.color} />
    </View>
  );
}

/** Small tinted status label. */
export function Pill(props: { label: string; color: string; bg: string }) {
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: props.bg }}>
      <Text style={{ color: props.color, fontSize: 12, fontWeight: "600" }}>{props.label}</Text>
    </View>
  );
}

/** Thin progress bar; `ratio` is clamped to 0..1. */
export function ProgressBar({ ratio, color = colors.primary }: { ratio: number; color?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
      <View style={{ height: 6, width: `${pct}%`, backgroundColor: color }} />
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
