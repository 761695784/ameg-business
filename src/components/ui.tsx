import { colors, radii, shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export type IconName = keyof typeof Ionicons.glyphMap;

// ==========================================
// 1. INPUT FIELD
// ==========================================
export function Field({
  label,
  required,
  error,
  helper,
  icon,
  multiline,
  style,
  containerStyle,
  ...props
}: TextInputProps & {
  label?: string;
  required?: boolean;
  error?: string;
  helper?: string;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.fieldContainer, containerStyle]}>
      {!!label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.requiredMark}> *</Text>}
        </View>
      )}
      <View
        style={[
          styles.inputWrapper,
          multiline && styles.multilineWrapper,
          error ? styles.inputWrapperError : null,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={error ? colors.danger : colors.textMuted}
            style={styles.fieldIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            multiline && styles.multilineInput,
            icon && { paddingLeft: 4 },
            style,
          ]}
          multiline={multiline}
          placeholderTextColor={colors.textLight}
          {...props}
        />
      </View>
      {!!error && (
        <View style={styles.helperRow}>
          <Ionicons name="alert-circle" size={13} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {!!helper && !error && <Text style={styles.helperText}>{helper}</Text>}
    </View>
  );
}

// ==========================================
// 2. BUTTON
// ==========================================
export type ButtonVariant =
  | "primary"
  | "primaryNavy"
  | "secondary"
  | "secondaryTeal"
  | "danger"
  | "subtle"
  | "success";

export type ButtonSize = "sm" | "md" | "lg";

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  disabled,
  loading,
  style,
  textStyle,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: "left" | "right";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const getColors = () => {
    switch (variant) {
      case "primary":
        return {
          bg: colors.accent,
          text: colors.white,
          border: "transparent",
          iconColor: colors.white,
        };
      case "primaryNavy":
        return {
          bg: colors.primary,
          text: colors.white,
          border: "transparent",
          iconColor: colors.white,
        };
      case "secondary":
        return {
          bg: colors.white,
          text: colors.primary,
          border: colors.border,
          iconColor: colors.primary,
        };
      case "secondaryTeal":
        return {
          bg: colors.secondaryLight,
          text: colors.secondaryDark,
          border: colors.secondary,
          iconColor: colors.secondary,
        };
      case "danger":
        return {
          bg: colors.dangerBg,
          text: colors.danger,
          border: colors.dangerBorder,
          iconColor: colors.danger,
        };
      case "success":
        return {
          bg: colors.success,
          text: colors.white,
          border: "transparent",
          iconColor: colors.white,
        };
      case "subtle":
        return {
          bg: "transparent",
          text: colors.textSecondary,
          border: "transparent",
          iconColor: colors.textMuted,
        };
      default:
        return {
          bg: colors.accent,
          text: colors.white,
          border: "transparent",
          iconColor: colors.white,
        };
    }
  };

  const scheme = getColors();
  const isSm = size === "sm";
  const isLg = size === "lg";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.buttonBase,
        {
          backgroundColor: scheme.bg,
          borderColor: scheme.border,
          borderWidth: scheme.border !== "transparent" ? 1 : 0,
          paddingVertical: isSm ? 8 : isLg ? 15 : 12,
          paddingHorizontal: isSm ? 12 : isLg ? 20 : 16,
        },
        variant === "primary" && shadows.sm,
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
        style,
      ]}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator size="small" color={scheme.iconColor} />
        ) : (
          <>
            {icon && iconPosition === "left" && (
              <Ionicons
                name={icon}
                size={isSm ? 16 : isLg ? 20 : 18}
                color={scheme.iconColor}
              />
            )}
            <Text
              style={[
                styles.buttonText,
                {
                  color: scheme.text,
                  fontSize: isSm ? 13 : isLg ? 16 : 14,
                  fontWeight: "700",
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
            {icon && iconPosition === "right" && (
              <Ionicons
                name={icon}
                size={isSm ? 16 : isLg ? 20 : 18}
                color={scheme.iconColor}
              />
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

// ==========================================
// 3. BADGE
// ==========================================
export function Badge({
  label,
  color,
  bgColor,
  borderColor,
  icon,
  size = "md",
}: {
  label: string;
  color: string;
  bgColor?: string;
  borderColor?: string;
  icon?: IconName;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor ?? color + "14",
          borderColor: borderColor ?? color + "40",
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 7 : 10,
        },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={isSm ? 11 : 13}
          color={color}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.badgeText,
          { color, fontSize: isSm ? 11 : 12, fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ==========================================
// 4. FLOATING ACTION BUTTON (FAB)
// ==========================================
export function Fab({
  onPress,
  icon = "add",
  label,
}: {
  onPress: () => void;
  icon?: IconName;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        label ? styles.fabExtended : null,
        pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.white} />
      {label && <Text style={styles.fabLabel}>{label}</Text>}
    </Pressable>
  );
}

// ==========================================
// 5. SEARCH BAR
// ==========================================
export function SearchBar({
  value,
  onChangeText,
  placeholder = "Rechercher...",
  onClear,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onClear?: () => void;
}) {
  return (
    <View style={styles.searchContainer}>
      <Ionicons
        name="search-outline"
        size={18}
        color={colors.textMuted}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {!!value && (
        <Pressable
          onPress={() => {
            onChangeText("");
            onClear?.();
          }}
          hitSlop={10}
          style={styles.clearBtn}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

// ==========================================
// 6. SEGMENTED TABS
// ==========================================
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentedContainer}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.segmentItem,
              active && styles.segmentItemActive,
              pressed && !active && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                active && styles.segmentLabelActive,
              ]}
            >
              {o.label}
            </Text>
            {o.count !== undefined && (
              <View
                style={[
                  styles.segmentCountBadge,
                  active && styles.segmentCountBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentCountText,
                    active && styles.segmentCountTextActive,
                  ]}
                >
                  {o.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ==========================================
// 7. EMPTY STATE
// ==========================================
export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title?: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      {title && <Text style={styles.emptyTitle}>{title}</Text>}
      <Text style={styles.emptyDescription}>{text}</Text>
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="sm"
          style={{ marginTop: 14 }}
        />
      )}
    </View>
  );
}

// ==========================================
// 8. SECTION HEADER
// ==========================================
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  count,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  count?: number;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && (
          <View style={styles.sectionCountBadge}>
            <Text style={styles.sectionCountText}>{count}</Text>
          </View>
        )}
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ==========================================
// 9. FORM / BOTTOM SHEET MODAL
// ==========================================
export function FormModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalScreen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.modalCloseBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.modalBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ==========================================
// 10. COMMON STYLES
// ==========================================
export const listStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardElevated: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 15,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  cardSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
  },
  price: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
    marginRight: 6,
  },
  hint: {
    fontSize: 13,
    color: colors.secondaryDark,
    marginTop: -6,
    marginBottom: 14,
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  // Field
  fieldContainer: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  requiredMark: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  multilineWrapper: {
    minHeight: 80,
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  inputWrapperError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
  },
  multilineInput: {
    textAlignVertical: "top",
    minHeight: 64,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Button
  buttonBase: {
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    letterSpacing: 0.2,
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.full,
    alignSelf: "flex-start",
  },
  badgeText: {
    letterSpacing: 0.2,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    minWidth: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    ...shadows.lg,
  },
  fabExtended: {
    borderRadius: radii.full,
    gap: 8,
  },
  fabLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    height: 44,
    ...shadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 2,
  },

  // Segmented
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    gap: 6,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.white,
    fontWeight: "700",
  },
  segmentCountBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  segmentCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  segmentCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  segmentCountTextActive: {
    color: colors.white,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 50,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCountBadge: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.secondaryDark,
  },

  // Modal
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 18,
    paddingBottom: 16,
  },
  modalTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: "#C9D6E6",
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  modalBody: {
    padding: 20,
    paddingBottom: 50,
  },
});
