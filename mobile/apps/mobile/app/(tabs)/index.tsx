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
  StyleSheet,
  ScrollView,
  Animated,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme-context";
import HomeScreen     from "../../components/screens/HomeScreen";
import CalendarScreen from "../../components/screens/CalendarScreen";
import InsightsScreen from "../../components/screens/InsightsScreen";
import ProfileScreen  from "../../components/screens/ProfileScreen";

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_SIZE        = 22;
const ICON_AREA_HEIGHT = 54;
const BUBBLE_SIZE      = 44;
const PAGE_COUNT       = 4;

// ─── TabIcon ──────────────────────────────────────────────────────────────────

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
    outputRange: [0.5, 1],
  });

  return (
    <View style={ti.wrap}>
      <Animated.View
        style={[ti.bubble, { opacity: anim, backgroundColor: bubbleColor }]}
      />
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

  // Per-icon triangle interpolations (peaks at own page, fades to neighbours)
  const anim0 = scrollX.interpolate({ inputRange: [0, screenW],                  outputRange: [1, 0], extrapolate: "clamp" });
  const anim1 = scrollX.interpolate({ inputRange: [0, screenW, 2 * screenW],     outputRange: [0, 1, 0], extrapolate: "clamp" });
  const anim2 = scrollX.interpolate({ inputRange: [screenW, 2 * screenW, 3 * screenW], outputRange: [0, 1, 0], extrapolate: "clamp" });
  const anim3 = scrollX.interpolate({ inputRange: [2 * screenW, 3 * screenW],   outputRange: [0, 1], extrapolate: "clamp" });

  const { tabBarBg, tabBarBorder, tabBarBubble, tabBarIcon } = theme.colors;

  return (
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
          <CalendarScreen />
        </View>
        <View style={[styles.page, { width: screenW }]}>
          <InsightsScreen />
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
          <TabIcon anim={anim0} bubbleColor={tabBarBubble} icon={
            <Ionicons name={activeIndex === 0 ? "home" : "home-outline"} size={ICON_SIZE} color={tabBarIcon} />
          } />
        </Pressable>

        {/* Calendar */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(1)}>
          <TabIcon anim={anim1} bubbleColor={tabBarBubble} icon={
            <Ionicons name={activeIndex === 1 ? "calendar" : "calendar-outline"} size={ICON_SIZE} color={tabBarIcon} />
          } />
        </Pressable>

        {/* Insights */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(2)}>
          <TabIcon anim={anim2} bubbleColor={tabBarBubble} icon={
            <Ionicons name={activeIndex === 2 ? "stats-chart" : "stats-chart-outline"} size={ICON_SIZE} color={tabBarIcon} />
          } />
        </Pressable>

        {/* Profile */}
        <Pressable style={styles.tabItem} onPress={() => goToPage(3)}>
          <TabIcon anim={anim3} bubbleColor={tabBarBubble} icon={
            <Ionicons name={activeIndex === 3 ? "person" : "person-outline"} size={ICON_SIZE} color={tabBarIcon} />
          } />
        </Pressable>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1 },
  pager:   { flex: 1 },
  page:    { flex: 1, overflow: "hidden" },
  tabBar:  {
    flexDirection:  "row",
    borderTopWidth: 1,
    paddingTop:     8,
  },
  tabItem: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
});
