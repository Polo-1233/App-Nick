/**
 * CoachInsightsScreen — Content + guidance hub
 *
 * Structure:
 *   1. Coach Insights  — horizontal carousel (Nick's videos/explanations)
 *   2. Content Library — Wind Down · MRM · CRP (vertical sections, horizontal scroll)
 *   3. Programs        — structured journeys
 *
 * Philosophy: calm, premium, spacious. Never overwhelming.
 * Max 1–2 sections visible without scrolling.
 */

import { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Pressable, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useRouter }    from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Analytics }    from '../../lib/analytics';
import { useTheme }     from '../../lib/theme-context';
import { addPoints }    from '../../lib/rhythm-points';
import { AmbientBackground } from '../ui/AmbientBackground';
import {
  COACH_INSIGHTS,
  WIND_DOWN_CONTENT,
  MRM_CONTENT,
  CRP_CONTENT,
  PROGRAMS,
  type ContentItem,
  type Program,
} from '../../lib/coach-content';

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT   = '#1c9fda';
const NAVY     = '#141466';
const CARD_BG  = '#141466';
const TEXT_W   = '#FFFFFF';
const TEXT_M   = '#A0B0CC';
const TEXT_F   = '#7A8FAA';
const GOLD     = '#F5A623';
const PURPLE   = '#A78BFA';
const BORDER   = 'rgba(255,255,255,0.06)';

// ─── Content type icon ────────────────────────────────────────────────────────
function typeIcon(type: ContentItem['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'video':    return 'play-circle-outline';
    case 'audio':    return 'headset-outline';
    case 'exercise': return 'body-outline';
    default:         return 'document-outline';
  }
}

// ─── Coach Insight Card (carousel) ───────────────────────────────────────────
function CoachCard({ item, cardW }: { item: ContentItem; cardW: number }) {
  return (
    <View style={[cc.card, { width: cardW }]}>
      {/* Thumbnail placeholder */}
      <View style={cc.thumb}>
        <View style={cc.playWrap}>
          <Ionicons name="play" size={22} color={TEXT_W} />
        </View>
        {!item.available && (
          <View style={cc.soon}>
            <Text style={cc.soonText}>Coming soon</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={cc.info}>
        <Text style={cc.title} numberOfLines={2}>{item.title}</Text>
        <View style={cc.meta}>
          <Ionicons name={typeIcon(item.type)} size={11} color={TEXT_F} />
          <Text style={cc.duration}>{item.duration}</Text>
        </View>
      </View>
    </View>
  );
}

const cc = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius:    16,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     BORDER,
  },
  thumb: {
    height:          120,
    backgroundColor: '#0d0d50',
    alignItems:      'center',
    justifyContent:  'center',
  },
  playWrap: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: `${ACCENT}30`,
    borderWidth:     1,
    borderColor:     `${ACCENT}60`,
    alignItems:      'center',
    justifyContent:  'center',
  },
  soon: {
    position:        'absolute',
    top:             10,
    right:           10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
  },
  soonText: {
    fontSize:   10,
    color:      TEXT_M,
    fontWeight: '500',
  },
  info: {
    padding: 12,
    gap:     6,
  },
  title: {
    fontSize:   13,
    fontWeight: '700',
    color:      TEXT_W,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  duration: {
    fontSize:   11,
    color:      TEXT_F,
  },
});

// ─── Content Library Card ─────────────────────────────────────────────────────
function LibraryCard({
  item,
  onPress,
}: {
  item:    ContentItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={item.available ? onPress : undefined}
      style={({ pressed }) => [lc.card, pressed && item.available && { opacity: 0.75 }]}
    >
      <View style={[lc.iconWrap, { backgroundColor: item.available ? `${ACCENT}20` : `rgba(255,255,255,0.10)` }]}>
        <Ionicons
          name={typeIcon(item.type)}
          size={16}
          color={item.available ? ACCENT : TEXT_M}
        />
      </View>
      <View style={lc.body}>
        <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
        {item.subtitle && <Text style={lc.sub} numberOfLines={1}>{item.subtitle}</Text>}
      </View>
      <View style={lc.right}>
        <Text style={lc.duration}>{item.duration}</Text>
        {item.available
          ? <Ionicons name="chevron-forward" size={14} color={TEXT_F} />
          : <Text style={lc.soon}>Soon</Text>
        }
      </View>
    </Pressable>
  );
}

const lc = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  iconWrap: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  body: {
    flex: 1,
    gap:  3,
  },
  title: {
    fontSize:   13,
    fontWeight: '600',
    color:      TEXT_W,
    flex:       1,
  },
  sub: {
    fontSize: 11,
    color:    TEXT_M,
  },
  right: {
    alignItems: 'flex-end',
    gap:        4,
    flexShrink: 0,
  },
  duration: {
    fontSize: 11,
    color:    TEXT_F,
  },
  soon: {
    fontSize:   10,
    color:      TEXT_F,
    fontStyle:  'italic',
  },
});

// ─── Content Section ──────────────────────────────────────────────────────────
function ContentSection({
  title,
  icon,
  iconColor,
  items,
  router,
}: {
  title:     string;
  icon:      keyof typeof Ionicons.glyphMap;
  iconColor: string;
  items:     ContentItem[];
  router:    ReturnType<typeof useRouter>;
}) {
  return (
    <View style={cs.wrap}>
      {/* Header */}
      <View style={cs.header}>
        <View style={[cs.iconWrap, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={icon} size={13} color={iconColor} />
        </View>
        <Text style={cs.title}>{title}</Text>
      </View>

      {/* List */}
      <View style={cs.list}>
        {items.map(item => (
          <LibraryCard
            key={item.id}
            item={item}
            onPress={() => {
              if (item.route) {
                // Award points for content engagement
                const pts = item.type === 'video' ? 1 : item.duration.includes('20') ? 5 : 3;
                void addPoints(pts, `content_${item.id}`);
                router.push(item.route as any);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  wrap: {
    backgroundColor: CARD_BG,
    borderRadius:    20,
    padding:         18,
    borderWidth:     1,
    borderColor:     BORDER,
    gap:             4,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  8,
  },
  iconWrap: {
    width:          24,
    height:         24,
    borderRadius:   7,
    alignItems:     'center',
    justifyContent: 'center',
  },
  title: {
    fontSize:   13,
    fontWeight: '700',
    color:      TEXT_M,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  list: {
    gap: 0,
  },
});

// ─── Program Card ─────────────────────────────────────────────────────────────
function ProgramCard({ program }: { program: Program }) {
  const started  = program.currentDay > 0;
  const progress = program.currentDay / program.totalDays;

  return (
    <View style={[pc.card, { borderColor: `${program.accent}30` }]}>
      {/* Header */}
      <View style={pc.header}>
        <View style={[pc.iconWrap, { backgroundColor: `${program.accent}18` }]}>
          <Ionicons name={program.icon as any} size={18} color={program.accent} />
        </View>
        <View style={pc.meta}>
          <Text style={pc.title}>{program.title}</Text>
          <Text style={pc.days}>{program.totalDays} days</Text>
        </View>
        {!program.available && (
          <View style={pc.badge}>
            <Text style={pc.badgeText}>Soon</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={pc.desc}>{program.description}</Text>

      {/* Progress bar */}
      <View style={pc.progressBg}>
        <View style={[pc.progressFill, { width: `${progress * 100}%`, backgroundColor: program.accent }]} />
      </View>

      {/* Day label */}
      <Text style={pc.progressLabel}>
        {started ? `Day ${program.currentDay} of ${program.totalDays}` : 'Not started'}
      </Text>
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius:    20,
    padding:         18,
    borderWidth:     1,
    gap:             12,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  iconWrap: {
    width:          40,
    height:         40,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  meta: {
    flex: 1,
    gap:  2,
  },
  title: {
    fontSize:   15,
    fontWeight: '800',
    color:      TEXT_W,
  },
  days: {
    fontSize: 11,
    color:    TEXT_F,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:       8,
  },
  badgeText: {
    fontSize:   11,
    color:      TEXT_F,
    fontWeight: '600',
  },
  desc: {
    fontSize:   13,
    color:      TEXT_M,
    lineHeight: 19,
  },
  progressBg: {
    height:          4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius:    2,
    overflow:        'hidden',
  },
  progressFill: {
    height:       4,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color:    TEXT_F,
  },
});

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return <Text style={st.text}>{title}</Text>;
}

const st = StyleSheet.create({
  text: {
    fontSize:      11,
    fontWeight:    '700',
    color:         TEXT_F,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CoachInsightsScreen() {
  const { theme }  = useTheme();
  const router     = useRouter();
  const { width }  = useWindowDimensions();

  useFocusEffect(useCallback(() => {
    Analytics.screenViewed('coach_insights');
  }, []));

  // Coach insight card width — 72% of screen width
  const cardW = width * 0.72;

  return (
    <AmbientBackground style={{ flex: 1 }}>
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={[s.title, { color: theme.colors.text }]}>Coach</Text>
          <Text style={[s.subtitle, { color: theme.colors.textMuted }]}>
            Learn the method. Build the habit.
          </Text>
        </View>

        {/* ── 1. Coach Insights carousel ── */}
        <View style={s.section}>
          <SectionTitle title="Coach Insights" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.carousel}
            decelerationRate="fast"
            snapToInterval={cardW + 12}
            snapToAlignment="start"
          >
            {COACH_INSIGHTS.map(item => (
              <CoachCard key={item.id} item={item} cardW={cardW} />
            ))}
          </ScrollView>
        </View>

        {/* ── 2. Content Library ── */}
        <View style={s.section}>
          <SectionTitle title="Content Library" />

          <ContentSection
            title="Wind Down"
            icon="moon-outline"
            iconColor="#A78BFA"
            items={WIND_DOWN_CONTENT}
            router={router}
          />

          <ContentSection
            title="MRM Library"
            icon="flash-outline"
            iconColor={GOLD}
            items={MRM_CONTENT}
            router={router}
          />

          <ContentSection
            title="CRP Library"
            icon="fitness-outline"
            iconColor="#3DDC97"
            items={CRP_CONTENT}
            router={router}
          />
        </View>

        {/* ── 3. Programs ── */}
        <View style={s.section}>
          <SectionTitle title="Programs" />
          {PROGRAMS.map(prog => (
            <ProgramCard key={prog.id} program={prog} />
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
    </AmbientBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: 'transparent' },
  content:  { padding: 20, paddingBottom: 120, gap: 28 },
  header:   { gap: 4, paddingBottom: 4 },
  title:    { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13 },
  section:  { gap: 14 },
  carousel: { gap: 12, paddingRight: 20 },
});
