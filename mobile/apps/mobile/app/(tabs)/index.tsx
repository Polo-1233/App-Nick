/**
 * Pager container — Revolut-style horizontal swipe navigation.
 *
 * Three pages (Home / Calendar / Profile) rendered side by side inside a
 * ScrollView with pagingEnabled. Pages follow the finger continuously and
 * snap to the nearest page on release.
 *
 * Bottom nav:
 *   - Bubble opacity is driven directly by scrollX (native thread, no JS jank).
 *   - Icon variant (filled/outline) updates on momentum scroll end.
 *   - Colors come from the active theme — adapts to light/dark.
 *   - Tap a tab icon → programmatic scrollTo().
 *
 * All three screens stay mounted (no remount flicker when switching pages).
 */

import { useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme-context";
import HomeScreen     from "../../components/screens/HomeScreen";
import CalendarScreen from "../../components/screens/CalendarScreen";
import ProfileScreen  from "../../components/screens/ProfileScreen";

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_SIZE        = 22;
const ICON_AREA_HEIGHT = 54;
const BUBBLE_SIZE      = 44;

// ─── TabIcon ──────────────────────────────────────────────────────────────────
// anim: 0 = inactive, 1 = active. Driven natively by scrollX interpolation.
// bubbleColor: themed translucent tint passed from PagerLayout.

type AnimNode = Animated.AnimatedInterpolation<string | number>;

function TabIcon({
  icon,
  anim,
  bubbleColor,
}: {
  icon:        React.ReactNode;
  anim:        AnimNode;
  bubbleColor: string;
}) {
  const iconOpacity = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <View style={ti.wrap}>
      {/* Bubble — themed translucent tint, fades with scroll position */}
      <Animated.View
        style={[ti.bubble, { opacity: anim, backgroundColor: bubbleColor }]}
      />
      {/* Icon — dims to 0.6 when inactive */}
      <Animated.View style={{ opacity: iconOpacity }}>
        {icon}
      </Animated.View>
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: {
    width:          BUBBLE_SIZE,
    height:         BUBBLE_SIZE,
    alignItems:     "center",
    justifyContent: "center",
  },
  bubble: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUBBLE_SIZE / 2,
    // backgroundColor is injected per-render via prop
  },
});

// ─── Pager ────────────────────────────────────────────────────────────────────

export default function PagerLayout() {
  const { theme }          = useTheme();
  const { width: screenW } = useWindowDimensions();
  const insets             = useSafeAreaInsets();
  const tabBarHeight       = ICON_AREA_HEIGHT + insets.bottom;

  const scrollRef  = useRef<ScrollView>(null);
  const scrollX    = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const goToPage = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * screenW, animated: true });
    },
    [screenW],
  );

  // Per-icon active animation — interpolated from scroll position on native thread.
  // Triangle function: each icon peaks at its own page and fades toward neighbours.
  const anim0 = scrollX.interpolate({
    inputRange:  [0, screenW],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const anim1 = scrollX.interpolate({
    inputRange:  [0, screenW, 2 * screenW],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });
  const anim2 = scrollX.interpolate({
    inputRange:  [screenW, 2 * screenW],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const { tabBarBg, tabBarBorder, tabBarBubble, tabBarIcon } = theme.colors;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>

      {/*
        ── Pager: three screens side by side ──
        MUST be Animated.ScrollView (not plain ScrollView) when using
        Animated.event with useNativeDriver:true. On RN 0.81+ (new arch/Fabric),
        Animated.event returns an AnimatedEvent object rather than a plain
        function. Plain ScrollView tries to call this.props.onScroll(event)
        directly and throws "onScroll is not a function (it is Object)".
        Animated.ScrollView wires up the native event driver correctly.
      */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / screenW));
        }}
        contentContainerStyle={{ width: screenW * 3 }}
        style={styles.pager}
      >
        <View style={[styles.page, { width: screenW }]}>
          <HomeScreen />
        </View>
        <View style={[styles.page, { width: screenW }]}>
          <CalendarScreen />
        </View>
        <View style={[styles.page, { width: screenW }]}>
          <ProfileScreen />
        </View>
      </Animated.ScrollView>

      {/* ── Custom tab bar ── */}
      <View
        style={[
          styles.tabBar,
          {
            height:          tabBarHeight,
            paddingBottom:   insets.bottom,
            backgroundColor: tabBarBg,
            borderTopColor:  tabBarBorder,
          },
        ]}
      >
        {/* Home */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(0)}>
          <TabIcon
            anim={anim0}
            bubbleColor={tabBarBubble}
            icon={
              <Ionicons
                name={activeIndex === 0 ? "home" : "home-outline"}
                size={ICON_SIZE}
                color={tabBarIcon}
              />
            }
          />
        </Pressable>

        {/* Calendar */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(1)}>
          <TabIcon
            anim={anim1}
            bubbleColor={tabBarBubble}
            icon={
              <Ionicons
                name={activeIndex === 1 ? "calendar" : "calendar-outline"}
                size={ICON_SIZE}
                color={tabBarIcon}
              />
            }
          />
        </Pressable>

        {/* Profile */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(2)}>
          <TabIcon
            anim={anim2}
            bubbleColor={tabBarBubble}
            icon={<Feather name="user" size={ICON_SIZE} color={tabBarIcon} />}
          />
        </Pressable>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // backgroundColor injected from theme
  },
  pager: {
    flex: 1,
  },
  page: {
    flex:     1,
    overflow: "hidden",
  },
  tabBar: {
    flexDirection:  "row",
    borderTopWidth: 1,
    paddingTop:     8,
    // backgroundColor, borderTopColor, height, paddingBottom injected from theme
  },
  tabItem: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
});
