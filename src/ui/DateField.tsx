import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { daysInMonth, isoDateToBr, monthLabel, monthToBr, parseBrDate, parseBrMonth, shiftMonth } from "@/domain/dates";
import { saoPauloDate } from "@/domain/entries";
import { Text } from "./form";
import { colors, RADIUS, ripple, spacing, TAP } from "./theme";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const CELL = 44;

/** Looks like a Field but opens a picker instead of the keyboard. */
function PickerButton(props: { label: string; text: string; placeholder?: string; disabled?: boolean; onPress: () => void }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontWeight: "600" }}>{props.label}</Text>
      <Pressable
        disabled={props.disabled}
        onPress={props.onPress}
        android_ripple={ripple}
        style={{
          minHeight: TAP,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: spacing.sm,
          overflow: "hidden",
          opacity: props.disabled ? 0.5 : 1,
        }}
      >
        <Text style={{ color: props.text ? colors.text : colors.placeholder }}>{props.text || props.placeholder}</Text>
        <Feather name="calendar" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function Dialog(props: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable
        onPress={props.onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.lg }}
      >
        <Pressable
          onPress={() => {}} // swallow taps so they do not close the dialog
          style={{ backgroundColor: colors.surface, borderRadius: RADIUS, padding: spacing.lg, gap: spacing.sm }}
        >
          {props.children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const Arrow = ({ icon, onPress }: { icon: "chevron-left" | "chevron-right"; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    android_ripple={{ ...ripple, borderless: true }}
    style={{ width: TAP, height: TAP, alignItems: "center", justifyContent: "center" }}
  >
    <Feather name={icon} size={24} color={colors.primary} />
  </Pressable>
);

const Link = ({ title, onPress }: { title: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={{ minHeight: TAP, justifyContent: "center", paddingHorizontal: spacing.md }}>
    <Text style={{ color: colors.primary, fontWeight: "600" }}>{title}</Text>
  </Pressable>
);

/** Day picker. `value` and `onChange` use the app's dd/mm/aaaa text, so forms keep parsing it as before. */
export function DateField(props: { label: string; value: string; onChange: (v: string) => void; editable?: boolean }) {
  const today = saoPauloDate(new Date().toISOString());
  const selected = parseBrDate(props.value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(today.slice(0, 7));

  const show = () => {
    setMonth((selected ?? today).slice(0, 7));
    setOpen(true);
  };
  const pick = (iso: string) => {
    props.onChange(isoDateToBr(iso));
    setOpen(false);
  };

  const lead = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)).getUTCDay();
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth(month) }, (_, i) => i + 1),
  ];
  const iso = (d: number) => `${month}-${String(d).padStart(2, "0")}`;

  return (
    <>
      <PickerButton
        label={props.label}
        text={props.value}
        placeholder="dd/mm/aaaa"
        disabled={props.editable === false}
        onPress={show}
      />
      <Dialog visible={open} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Arrow icon="chevron-left" onPress={() => setMonth((m) => shiftMonth(m, -1))} />
          <Text style={{ fontWeight: "600", fontSize: 16 }}>{monthLabel(month)}</Text>
          <Arrow icon="chevron-right" onPress={() => setMonth((m) => shiftMonth(m, 1))} />
        </View>
        <View style={{ flexDirection: "row" }}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: "center", color: colors.muted, fontSize: 12 }}>
              {w}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((d, i) => (
            <View key={i} style={{ width: `${100 / 7}%`, height: CELL, alignItems: "center", justifyContent: "center" }}>
              {d !== null && (
                <Pressable
                  onPress={() => pick(iso(d))}
                  android_ripple={{ ...ripple, borderless: true }}
                  style={{
                    width: CELL - 4,
                    height: CELL - 4,
                    borderRadius: (CELL - 4) / 2,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: iso(d) === selected ? colors.primary : "transparent",
                    borderWidth: iso(d) === today && iso(d) !== selected ? 1 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text style={{ color: iso(d) === selected ? colors.primaryText : colors.text }}>{d}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Link title="Hoje" onPress={() => pick(today)} />
          <Link title="Cancelar" onPress={() => setOpen(false)} />
        </View>
      </Dialog>
    </>
  );
}

/** Month picker for mm/aaaa values; with `optional` there is a "Sem fim" button that clears it. */
export function MonthField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  const current = saoPauloDate(new Date().toISOString()).slice(0, 7);
  const selected = parseBrMonth(props.value);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(current.slice(0, 4)));

  const show = () => {
    setYear(Number((selected ?? current).slice(0, 4)));
    setOpen(true);
  };
  const pick = (ym: string) => {
    props.onChange(monthToBr(ym));
    setOpen(false);
  };

  return (
    <>
      <PickerButton label={props.label} text={props.value} placeholder={props.placeholder ?? "mm/aaaa"} onPress={show} />
      <Dialog visible={open} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Arrow icon="chevron-left" onPress={() => setYear((y) => y - 1)} />
          <Text style={{ fontWeight: "600", fontSize: 16 }}>{year}</Text>
          <Arrow icon="chevron-right" onPress={() => setYear((y) => y + 1)} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {SHORT_MONTHS.map((name, i) => {
            const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
            const on = ym === selected;
            return (
              <View key={ym} style={{ width: "25%", padding: 3 }}>
                <Pressable
                  onPress={() => pick(ym)}
                  android_ripple={ripple}
                  style={{
                    minHeight: TAP,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: spacing.sm,
                    overflow: "hidden",
                    backgroundColor: on ? colors.primary : colors.surfaceHigh,
                    borderWidth: ym === current && !on ? 1 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text style={{ color: on ? colors.primaryText : colors.text }}>{name}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {props.optional ? (
            <Link
              title="Sem fim"
              onPress={() => {
                props.onChange("");
                setOpen(false);
              }}
            />
          ) : (
            <View />
          )}
          <Link title="Cancelar" onPress={() => setOpen(false)} />
        </View>
      </Dialog>
    </>
  );
}
