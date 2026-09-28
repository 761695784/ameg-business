import { Badge, listStyles } from "@/components/ui";
import { colors, radii, shadows } from "@/constants/theme";
import {
  STATUS_COLORS,
  statusLabel,
  type DocListRow,
} from "@/db/queries";
import { formatDate, formatFCFA } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function DocRow({
  doc,
  onPress,
}: {
  doc: DocListRow;
  onPress?: () => void;
}) {
  const isInvoice = doc.type === "facture";
  const totalTtc = doc.total_ttc;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/documents/${doc.id}`);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
      onPress={handlePress}
    >
      {/* Left indicator stripe based on type */}
      <View
        style={[
          styles.typePill,
          { backgroundColor: isInvoice ? colors.primary : colors.secondary },
        ]}
      >
        <Ionicons
          name={isInvoice ? "receipt-outline" : "document-text-outline"}
          size={18}
          color={colors.white}
        />
        <Text style={styles.typeLabel}>{isInvoice ? "FAC" : "DEV"}</Text>
      </View>

      <View style={listStyles.cardBody}>
        <View style={styles.topRow}>
          <Text style={styles.docNumber}>{doc.number}</Text>
          <Badge
            label={statusLabel(doc.type, doc.status)}
            color={STATUS_COLORS[doc.status]}
            size="sm"
          />
        </View>

        <View style={styles.clientRow}>
          <Ionicons
            name="person-circle-outline"
            size={14}
            color={colors.textMuted}
          />
          <Text style={styles.clientName} numberOfLines={1}>
            {doc.client_name ?? "Client non spécifié"}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={colors.textMuted}
            />
            <Text style={styles.dateText}>{formatDate(doc.date)}</Text>
            {doc.tva_enabled === 1 && (
              <Text style={styles.tvaTag}>TVA 18%</Text>
            )}
          </View>
          <Text style={styles.priceAmount}>{formatFCFA(totalTtc)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  typePill: {
    width: 44,
    height: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    paddingVertical: 4,
  },
  typeLabel: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  docNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.2,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  clientName: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
    flex: 1,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  tvaTag: {
    fontSize: 10,
    color: colors.secondaryDark,
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.xs,
    fontWeight: "700",
    marginLeft: 4,
  },
  priceAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
});
