/**
 * rhythm-points.ts — Système de points et de streak R90
 *
 * Points : récompense les actions clés (ARP confirm, MRM, CRP, wind-down)
 * Flow   : streak de jours consécutifs alignés
 *
 * Grace rule : streak reset après 2 jours non-alignés (pas 1)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const POINTS_KEY = '@r90:rhythmPoints:v1';
const FLOW_KEY   = '@r90:rhythmFlow:v1';

export const POINTS = {
  ARP_CONFIRM:       5,
  MRM_COMPLETE:      2,
  CRP_COMPLETE:      5,
  WINDDOWN_START:    3,
  WINDDOWN_CONTENT:  3,
  COACH_VIDEO:       1,   // short video watched
  COACH_AUDIO_SHORT: 3,   // MRM/wind-down audio (< 10 min)
  COACH_AUDIO_LONG:  5,   // CRP/NSDR audio (≥ 20 min)
  PROGRAM_DAY:       10,  // program daily step completed
} as const;

export interface RhythmPointsState {
  total:      number;
  today:      number;
  lastUpdate: string; // ISO date
}

export interface RhythmFlowState {
  currentStreak: number;
  bestStreak:    number;
  lastActiveDate: string;
  weekAligned:   number; // 0-7
}

// ─── Points ──────────────────────────────────────────────────────────────────

export async function getPoints(): Promise<RhythmPointsState> {
  const raw = await AsyncStorage.getItem(POINTS_KEY).catch(() => null);
  if (!raw) return { total: 0, today: 0, lastUpdate: '' };
  return JSON.parse(raw) as RhythmPointsState;
}

export async function addPoints(amount: number, _reason: string): Promise<number> {
  const state = await getPoints();
  const today = new Date().toISOString().slice(0, 10);

  const todayTotal = state.lastUpdate === today ? state.today + amount : amount;
  const updated: RhythmPointsState = {
    total:      state.total + amount,
    today:      todayTotal,
    lastUpdate: today,
  };
  await AsyncStorage.setItem(POINTS_KEY, JSON.stringify(updated));
  return updated.total;
}

// ─── Flow (streak) ────────────────────────────────────────────────────────────

export async function getFlow(): Promise<RhythmFlowState> {
  const raw = await AsyncStorage.getItem(FLOW_KEY).catch(() => null);
  if (!raw) return { currentStreak: 0, bestStreak: 0, lastActiveDate: '', weekAligned: 0 };
  return JSON.parse(raw) as RhythmFlowState;
}

/**
 * updateFlow — appelé chaque jour (au confirm matin).
 * Grace rule : streak reset uniquement après 2 jours manqués.
 */
export async function updateFlow(dayAligned: boolean): Promise<void> {
  const flow  = await getFlow();
  const today = new Date().toISOString().slice(0, 10);

  if (flow.lastActiveDate === today) return; // déjà mis à jour aujourd'hui

  let streak = flow.currentStreak;
  if (dayAligned) {
    streak = streak + 1;
  } else {
    // Grace: on vérifie si hier était déjà manqué
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (flow.lastActiveDate !== yesterdayStr) {
      // Deux jours sans activité → reset
      streak = 0;
    }
    // Un seul jour manqué → on garde le streak (grâce douce)
  }

  // Calculer weekAligned (approximation basée sur le streak)
  const weekAligned = Math.min(7, dayAligned ? flow.weekAligned + 1 : flow.weekAligned);

  const updated: RhythmFlowState = {
    currentStreak:  streak,
    bestStreak:     Math.max(flow.bestStreak, streak),
    lastActiveDate: today,
    weekAligned:    new Date().getDay() === 1 ? (dayAligned ? 1 : 0) : weekAligned, // reset lundi
  };
  await AsyncStorage.setItem(FLOW_KEY, JSON.stringify(updated));
}
