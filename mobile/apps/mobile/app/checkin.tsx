/**
 * checkin.tsx — Daily Check-In screen
 * Fetches dynamic questions from GET /screen/checkin
 * Submits answers to POST /logs/checkin
 */
import { useState, useEffect, useRef } from "react";
import {
  View, Text, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getCheckInPayload, submitCheckIn, type CheckInQuestion } from "../lib/api";
import { useTheme } from "../lib/theme-context";
import { MascotImage } from "../components/ui/MascotImage";
import { Button } from "../components/ui/Button";

export default function CheckInScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

  const [questions,     setQuestions]     = useState<CheckInQuestion[]>([]);
  const [answers,       setAnswers]       = useState<Record<string, unknown>>({});
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [done,          setDone]          = useState(false);
  const [date,          setDate]          = useState("");
  const [currentIndex,  setCurrentIndex]  = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!done) return;
    timerRef.current = setTimeout(() => router.back(), 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [done, router]);

  useEffect(() => {
    getCheckInPayload().then(result => {
      if (result.ok && result.data) {
        setQuestions(result.data.questions);
        setAnswers(result.data.prefilled as Record<string, unknown>);
        setDate(result.data.daily_log_date);
      }
      setLoading(false);
    });
  }, []);

  async function handleSubmit() {
    if (!date) return;
    setSaving(true);
    const result = await submitCheckIn({ date, ...answers as Record<string, never> });
    setSaving(false);
    if (result.ok) {
      setDone(true);
    } else {
      Alert.alert("Error", result.error ?? "Could not submit check-in.");
    }
  }

  function setAnswer(id: string, value: unknown) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  function goToQuestion(newIndex: number) {
    const direction = newIndex > currentIndex ? 1 : -1;
    Animated.timing(slideAnim, {
      toValue: -direction * 60,
      duration: 130,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(newIndex);
      slideAnim.setValue(direction * 60);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }).start();
    });
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={[s.center, { backgroundColor: c.background }]}>
        <MascotImage emotion="celebration" size="lg" />
        <Text style={[s.doneText, { color: c.text }]}>Check-in saved ✓</Text>
      </View>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const isFirst = currentIndex === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.background }]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* R-Lo */}
        <View style={s.mascotRow}>
          <MascotImage emotion="Reflexion" size="md" />
        </View>

        {/* Title */}
        <Text style={[s.title, { color: c.text }]}>Daily Check-In</Text>

        {/* Progress indicator */}
        {questions.length > 1 && (
          <View style={s.progressRow}>
            {questions.map((_, i) => (
              <View
                key={i}
                style={[
                  s.progressDot,
                  {
                    backgroundColor: i === currentIndex ? c.accent
                      : i < currentIndex ? c.accentSecondary
                      : c.surface2,
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Question card */}
        {currentQuestion && (
          <Animated.View
            style={[
              s.questionCard,
              { backgroundColor: c.surface, transform: [{ translateX: slideAnim }] },
            ]}
          >
            <Text style={[s.questionLabel, { color: c.textSub }]}>
              Question {currentIndex + 1} of {questions.length}
            </Text>
            <Text style={[s.questionText, { color: c.text }]}>
              {currentQuestion.label_key.replace(/_/g, " ")}
            </Text>

            {/* Boolean answers */}
            {currentQuestion.type === "boolean" && (
              <View style={s.answerRow}>
                {(["Yes", "No"] as const).map(option => {
                  const val = option === "Yes";
                  const selected = answers[currentQuestion.id] === val;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        s.answerCard,
                        {
                          backgroundColor: selected ? `${c.accent}26` : c.surface2,
                          borderColor:     selected ? c.accent : c.border,
                          flex: 1,
                        },
                      ]}
                      onPress={() => {
                        setAnswer(currentQuestion.id, val);
                        if (!isLast) setTimeout(() => goToQuestion(currentIndex + 1), 200);
                      }}
                    >
                      <Text style={[
                        s.answerText,
                        { color: selected ? c.accent : c.text },
                      ]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Scale answers */}
            {currentQuestion.type === "scale" && (
              <View style={s.answerRow}>
                {[1, 2, 3, 4, 5].map(n => {
                  const selected = answers[currentQuestion.id] === n;
                  return (
                    <Pressable
                      key={n}
                      style={[
                        s.answerCard,
                        {
                          backgroundColor: selected ? `${c.accent}26` : c.surface2,
                          borderColor:     selected ? c.accent : c.border,
                          flex: 1,
                        },
                      ]}
                      onPress={() => {
                        setAnswer(currentQuestion.id, n);
                        if (!isLast) setTimeout(() => goToQuestion(currentIndex + 1), 200);
                      }}
                    >
                      <Text style={[
                        s.answerText,
                        { color: selected ? c.accent : c.text },
                      ]}>
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

        {/* Navigation */}
        {questions.length > 1 && (
          <View style={s.navRow}>
            <Pressable
              style={[s.navBtn, { opacity: isFirst ? 0.3 : 1, backgroundColor: c.surface2 }]}
              onPress={() => !isFirst && goToQuestion(currentIndex - 1)}
              disabled={isFirst}
            >
              <Text style={[s.navBtnText, { color: c.text }]}>←</Text>
            </Pressable>
            <Pressable
              style={[s.navBtn, { opacity: isLast ? 0.3 : 1, backgroundColor: c.surface2 }]}
              onPress={() => !isLast && goToQuestion(currentIndex + 1)}
              disabled={isLast}
            >
              <Text style={[s.navBtnText, { color: c.text }]}>→</Text>
            </Pressable>
          </View>
        )}

        {/* Submit */}
        <View style={s.submitBlock}>
          <Button
            label="Submit"
            onPress={() => { void handleSubmit(); }}
            variant="primary"
            fullWidth
            loading={saving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1 },
  scroll:     { flex: 1 },
  content:    { padding: 24, paddingBottom: 48 },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },

  mascotRow:  { alignItems: "center", marginBottom: 12 },
  title:      { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 16 },
  doneText:   { fontSize: 22, fontWeight: "600" },

  progressRow: {
    flexDirection: "row",
    gap:           6,
    marginBottom:  20,
  },
  progressDot: {
    flex:         1,
    height:       3,
    borderRadius: 2,
  },

  questionCard: {
    borderRadius:  16,
    padding:       20,
    marginBottom:  16,
    gap:           12,
  },
  questionLabel: {
    fontSize:   12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize:   18,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    lineHeight: 26,
    textTransform: "capitalize",
  },

  answerRow: {
    flexDirection: "row",
    gap:           10,
    marginTop:     4,
  },
  answerCard: {
    borderRadius:  12,
    paddingVertical: 16,
    alignItems:    "center",
    borderWidth:   1.5,
  },
  answerText: {
    fontSize:   16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  navRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    gap:            12,
    marginBottom:   16,
  },
  navBtn: {
    flex:           1,
    paddingVertical: 12,
    borderRadius:   12,
    alignItems:     "center",
  },
  navBtnText: {
    fontSize:   18,
    fontWeight: "600",
  },

  submitBlock: {
    marginTop: 8,
  },
});
