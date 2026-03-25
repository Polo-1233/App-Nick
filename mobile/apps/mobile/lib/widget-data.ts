/**
 * widget-data.ts — Data bridge for iOS Widget
 *
 * Prepares and persists structured data that the native iOS widget
 * reads via shared App Group UserDefaults.
 *
 * Called after each plan refresh (from use-day-plan.ts) to keep
 * the widget data fresh.
 *
 * The actual widget UI is implemented in Swift (WidgetKit) at:
 *   /ios/R90Widget/R90Widget.swift
 *
 * Data format (JSON string in UserDefaults):
 *   {
 *     "streak": 12,
 *     "rhythmScore": 87,
 *     "nextEvent": "CRP in 45 min",
 *     "nextEventType": "crp",
 *     "nextEventMin": 45,
 *     "sleepWindow": "23:00",
 *     "wakeTime": "06:30",
 *     "currentCycle": 5,
 *     "totalCycles": 11,
 *     "rloMessage": "Your rhythm is on track.",
 *     "levelLabel": "Attuned",
 *     "levelColor": "#1c9fda",
 *     "updatedAt": "2026-03-25T14:30:00Z"
 *   }
 *
 * To implement the widget:
 *   1. Create an App Group in Xcode (e.g. group.com.metalab.r90navigator)
 *   2. Add WidgetKit target
 *   3. Read the JSON from UserDefaults(suiteName: "group.com.metalab.r90navigator")
 *   4. Parse and render in SwiftUI
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const WIDGET_DATA_KEY = '@r90:widgetData:v1';

export interface WidgetData {
  streak:         number;
  rhythmScore:    number;         // 0-100
  nextEvent:      string | null;  // "CRP in 45 min"
  nextEventType:  string | null;  // "mrm" | "crp" | "winddown"
  nextEventMin:   number | null;  // minutes until
  sleepWindow:    string;         // "23:00"
  wakeTime:       string;         // "06:30"
  currentCycle:   number;
  totalCycles:    number;
  rloMessage:     string;
  levelLabel:     string;
  levelColor:     string;
  updatedAt:      string;         // ISO 8601
}

/**
 * Update the widget data. Call after each plan refresh.
 *
 * For now, persists to AsyncStorage (readable by the app).
 * When the native widget is built, this will also write to
 * shared UserDefaults via a native module.
 */
export async function updateWidgetData(data: WidgetData): Promise<void> {
  const json = JSON.stringify(data);

  // Persist locally (for debugging / fallback)
  await AsyncStorage.setItem(WIDGET_DATA_KEY, json).catch(() => {});

  // Write to shared App Group UserDefaults so the iOS WidgetKit extension
  // can read the data without IPC.  SharedDefaultsModule is registered at
  // ios/SharedDefaultsModule/SharedDefaultsModule.swift
  if (Platform.OS === 'ios') {
    try {
      NativeModules.SharedDefaultsModule?.set(
        'widgetData',
        json,
        'group.com.metalab.r90navigator',
      );
      // Ask WidgetKit to reload all timelines immediately
      NativeModules.SharedDefaultsModule?.reloadAllTimelines();
    } catch (e) {
      // Native module not linked yet (e.g. Expo Go) — silently skip
      if (__DEV__) console.warn('[updateWidgetData] native module unavailable:', e);
    }
  }
}

/**
 * Read the last persisted widget data.
 */
export async function getWidgetData(): Promise<WidgetData | null> {
  const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY).catch(() => null);
  if (!raw) return null;
  return JSON.parse(raw) as WidgetData;
}
