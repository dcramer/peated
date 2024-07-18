import { Tabs } from "expo-router";
import React from "react";

import theme from "@peated/design";
import {
  GlobeAmericasIcon,
  StarIcon,
  UserGroupIcon,
} from "react-native-heroicons/solid";

export default function TabLayout() {
  return (
    <Tabs
      sceneContainerStyle={{
        backgroundColor: theme.colors.black,
        borderColor: theme.colors.slate[700],
      }}
      screenOptions={{
        tabBarActiveTintColor: theme.colors.highlight,
        tabBarInactiveTintColor: theme.colors.light,
        tabBarStyle: {
          backgroundColor: theme.colors.slate[950],
          borderTopColor: theme.colors.slate[700],
        },
        tabBarItemStyle: {
          borderColor: theme.colors.slate[700],
        },
        tabBarShowLabel: false,
        headerStyle: {
          backgroundColor: theme.colors.slate[950],
        },
        headerTintColor: theme.colors.light,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShown: false,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        // headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => <GlobeAmericasIcon color={color} />,
          // headerRight: () => (
          //   <Link href="/modal" asChild>
          //     <Pressable>
          //       {({ pressed }) => (
          //         <FontAwesome
          //           name="info-circle"
          //           size={25}
          //           color={Colors.text}
          //           style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
          //         />
          //       )}
          //     </Pressable>
          //   </Link>
          // ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color }) => <StarIcon color={color} />,
        }}
      />
      {/* <Tabs.Screen
        name="addTasting"
        options={{
          title: "Add Tasting",
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
        }}
      /> */}
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color }) => <UserGroupIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          // tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
        }}
      />
    </Tabs>
  );
}
