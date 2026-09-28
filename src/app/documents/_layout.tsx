import { colors } from "@/constants/theme";
import { Stack } from "expo-router";

export const unstable_settings = { initialRouteName: "index" };

export default function DocumentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Devis & Factures",
          headerTitle: "Documents Commerciaux",
        }}
      />
      <Stack.Screen
        name="requests"
        options={{
          title: "Demandes du site",
          headerBackTitle: "Retour",
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Document",
          headerBackTitle: "Retour",
        }}
      />
    </Stack>
  );
}
