import { colors } from "@/constants/theme";
import { migrateDb } from "@/db/schema";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { Platform } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

function makeTabIcon(activeIcon: IconName, inactiveIcon: IconName) {
  const IconComponent = ({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) => {
    return (
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={focused ? size + 1 : size}
        color={color}
      />
    );
  };
  IconComponent.displayName = `TabIcon(${activeIcon})`;
  return IconComponent;
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="ameg-business.db" onInit={migrateDb}>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.white,
          headerTitleStyle: {
            fontWeight: "800",
            fontSize: 18,
          },
          headerShadowVisible: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: Platform.OS === "ios" ? 88 : 64,
            paddingTop: 6,
            paddingBottom: Platform.OS === "ios" ? 28 : 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            headerTitle: "Ameg Business",
            tabBarIcon: makeTabIcon("home", "home-outline"),
          }}
        />
        <Tabs.Screen
          name="documents"
          options={{
            title: "Documents",
            headerShown: false,
            tabBarIcon: makeTabIcon("receipt", "receipt-outline"),
          }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: "Clients",
            headerTitle: "Gestion des Clients",
            tabBarIcon: makeTabIcon("people", "people-outline"),
          }}
        />
        <Tabs.Screen
          name="items"
          options={{
            title: "Articles",
            headerTitle: "Catalogue d'Articles",
            tabBarIcon: makeTabIcon("cube", "cube-outline"),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Paramètres",
            headerTitle: "Paramètres Entreprise",
            tabBarIcon: makeTabIcon("settings", "settings-outline"),
          }}
        />
      </Tabs>
    </SQLiteProvider>
  );
}
