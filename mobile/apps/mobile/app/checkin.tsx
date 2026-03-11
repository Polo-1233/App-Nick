/**
 * checkin.tsx — Daily Check-In screen
 * Fetches dynamic questions from GET /screen/checkin
 * Submits answers to POST /logs/checkin
 */
import { useState, useEffect } from "react";
import {
  View, Text, Switch, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { getCheckInPayload, submitCheckIn, type CheckInQuestion } from "../lib/api";

export default function CheckInScreen() {
  const router = useRouter();
  const [questions, setQuestions] = useState<CheckInQuestion[]>([]);
  const [answers,   setAnswers]   = useState<Record<string, unknown>>({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(false);
  const [date,      setDate]      = useState("");

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
      setTimeout(() => router.back(), 1500);
    } else {
      Alert.alert("Error", result.error ?? "Could not submit check-in.");
    }
  }

  function setAnswer(id: string, value: unknown) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  if (done) {
    return (
      <View style={s.center}>
        <Text style={s.doneText}>✓ Check-in saved</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Daily Check-In</Text>

        {questions.map(q => (
          <View key={q.id} style={s.questionRow}>
            <Text style={s.questionLabel}>{q.label_key.replace(/_/g, " ")}</Text>

            {q.type === "boolean" && (
              <Switch
                value={Boolean(answers[q.id])}
                onValueChange={v => setAnswer(q.id, v)}
                trackColor={{ false: "#2A2A2A", true: "#22C55E" }}
              />
            )}

            {q.type === "scale" && (
              <View style={s.scaleRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Pressable
                    key={n}
                    style={[s.scaleBtn, answers[q.id] === n && s.scaleBtnActive]}
                    onPress={() => setAnswer(q.id, n)}
                  >
                    <Text style={[s.scaleBtnText, answers[q.id] === n && s.scaleBtnTextActive]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}

        <Pressable
          style={[s.submitBtn, saving && s.submitBtnDisabled]}
          onPress={() => { void handleSubmit(); }}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#000" />
            : <Text style={s.submitText}>Submit</Text>
          }
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: "#0D0D0D" },
  scroll:          { flex: 1 },
  content:         { padding: 24, paddingBottom: 48, gap: 20 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D0D0D" },
  title:           { color: "#FFFFFF", fontSize: 28, fontWeight: "700", marginBottom: 8 },
  doneText:        { color: "#22C55E", fontSize: 22, fontWeight: "600" },
  questionRow:     { gap: 10 },
  questionLabel:   { color: "#FFFFFF", fontSize: 15, fontWeight: "500", textTransform: "capitalize" },
  scaleRow:        { flexDirection: "row", gap: 8 },
  scaleBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2A2A2A" },
  scaleBtnActive:  { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  scaleBtnText:    { color: "#9CA3AF", fontWeight: "600" },
  scaleBtnTextActive: { color: "#000000" },
  submitBtn:       { backgroundColor: "#22C55E", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:      { color: "#000000", fontSize: 16, fontWeight: "700" },
});
