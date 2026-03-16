/**
 * Pager container — Revolut-style horizontal swipe navigation.
 *
 * Four pages: Home / Calendar / Insights / Profile
 *
 * Bottom nav:
 *   - Bubble opacity driven directly by scrollX (native thread, no JS jank).
 *   - Icon variant (filled/outline) updates on momentum scroll end.
 *   - Colors come from the active theme — adapts to light/dark.
 *   - Tap a tab icon → programmatic scrollTo().
 *
 * All screens stay mounted (no remount flicker when switching pages).
 */

import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme-context";
import { PagerContext } from "../../lib/pager-context";
import HomeScreen     from "../../components/screens/HomeScreen";
import CalendarScreen from "../../components/screens/CalendarScreen";
import InsightsScreen from "../../components/screens/InsightsScreen";
import ProfileScreen  from "../../components/screens/ProfileScreen";

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_SIZE        = 20;
const BUBBLE_SIZE      = 36;
const PAGE_COUNT       = 4;

// ─── TabIcon ──────────────────────────────────────────────────────────────────

type AnimNode = Animated.AnimatedInterpolation<string | number>;

function TabIcon({
  icon,
  label,
  anim,
  bubbleColor,
  iconColor,
}: {
  icon:        React.ReactNode;
  label:       string;
  anim:        AnimNode;
  bubbleColor: string;
  iconColor:   string;
}) {
  const iconOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const labelOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <View style={ti.wrap}>
      <View style={ti.iconRow}>
        <Animated.View style={[ti.bubble, { opacity: anim, backgroundColor: bubbleColor }]} />
        <Animated.View style={{ opacity: iconOpacity }}>
          {icon}
        </Animated.View>
      </View>
      <Animated.Text style={[ti.label, { color: iconColor, opacity: labelOpacity }]}>
        {label}
      </Animated.Text>
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: {
    alignItems:     "center",
    justifyContent: "center",
    gap:            3,
  },
  iconRow: {
    width:          BUBBLE_SIZE,
    height:         BUBBLE_SIZE,
    alignItems:     "center",
    justifyContent: "center",
  },
  bubble: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUBBLE_SIZE / 2,
  },
  label: {
    fontSize:      10,
    fontWeight:    "500",
    letterSpacing: 0.1,
  },
});

// ─── Pager ────────────────────────────────────────────────────────────────────

export default function PagerLayout() {
  const { theme }          = useTheme();
  const { width: screenW } = useWindowDimensions();
  const insets             = useSafeAreaInsets();
  // Height = bubble (36) + label (12) + gap (3) + paddingTop (6) + paddingBottom (4) + safe area
  const CONTENT_H    = BUBBLE_SIZE + 12 + 3 + 6 + 4;
  const tabBarHeight = CONTENT_H + insets.bottom;

  const scrollRef  = useRef<ScrollView>(null);
  const scrollX    = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const goToPage = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * screenW, animated: true });
    },
    [screenW],
  );

  // Per-icon triangle interpolations (peaks at own page, fades to neighbours)
  const anim0 = scrollX.interpolate({ inputRange: [0, screenW],                  outputRange: [1, 0], extrapolate: "clamp" });
  const anim1 = scrollX.interpolate({ inputRange: [0, screenW, 2 * screenW],     outputRange: [0, 1, 0], extrapolate: "clamp" });
  const anim2 = scrollX.interpolate({ inputRange: [screenW, 2 * screenW, 3 * screenW], outputRange: [0, 1, 0], extrapolate: "clamp" });
  const anim3 = scrollX.interpolate({ inputRange: [2 * screenW, 3 * screenW],   outputRange: [0, 1], extrapolate: "clamp" });

  const { tabBarBg, tabBarBorder, tabBarBubble, tabBarIcon } = theme.colors;

  return (
    <PagerContext.Provider value={{ goToPage }}>
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>

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
        contentContainerStyle={{ width: screenW * PAGE_COUNT }}
        style={styles.pager}
      >
        <View style={[styles.page, { width: screenW }]}>
          <HomeScreen />
        </View>
        <View style={[styles.page, { width: screenW }]}>
          <InsightsScreen />
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
            paddingBottom:   insets.bottom || 4,
            backgroundColor: tabBarBg,
            borderTopColor:  tabBarBorder,
          },
        ]}
      >
        {/* Home */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(0)}>
          <TabIcon anim={anim0} bubbleColor={tabBarBubble} iconColor={tabBarIcon} label="Coach" icon={
            <Ionicons name={activeIndex === 0 ? "home" : "home-outline"} size={ICON_SIZE} color={tabBarIcon} />
          } />
        </Pressable>

        {/* Insights */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(1)}>
          <TabIcon anim={anim1} bubbleColor={tabBarBubble} iconColor={tabBarIcon} label="Insights" icon={
            <Ionicons name={activeIndex === 1 ? "stats-chart" : "stats-chart-outline"} size={ICON_SIZE} color={tabBarIcon} />
          } />
        </Pressable>

        {/* Calendar */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(2)}>
          <TabIcon anim={anim2} bubbleColor={tabBarBubble} iconColor={tabBarIcon} label="Planning" icon={
            <Ionicons name={activeIndex === 2 ? "calendar" : "calendar-outline"} size={ICON_SIZE} color={tabBarIcon} />
          } />
        </Pressable>

        {/* Profile */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(3)}>
          <TabIcon anim={anim3} bubbleColor={tabBarBubble} iconColor={tabBarIcon} label="Profile" icon={
            <Ionicons name={activeIndex === 3 ? "person" : "person-outline"} size={ICON_SIZE} color={tabBarIcon} />
          } />
        </Pressable>
      </View>

    </View>
    </PagerContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1 },
  pager:   { flex: 1 },
  page:    { flex: 1, overflow: "hidden" },
  tabBar:  {
    flexDirection:  "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop:     6,
  },
  tabItem: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
});
