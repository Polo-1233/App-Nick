/**
 * wearables.ts — Wearable data sync + OAuth endpoints
 *
 * POST /wearables/sync          — Apple Health (direct data push from app)
 * GET  /wearables/status        — connected sources for current user
 * GET  /wearables/latest        — latest snapshot per source
 *
 * Phase B (Oura / Whoop) — OAuth endpoints added when keys are available:
 * GET  /wearables/oura/connect  — redirect to Oura OAuth
 * GET  /wearables/oura/callback — OAuth callback
 * GET  /wearables/whoop/connect — redirect to Whoop OAuth
 * GET  /wearables/whoop/callback
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';

export const wearablesRouter = Router();

// ─── POST /wearables/sync ─────────────────────────────────────────────────────

interface AppleHealthPayload {
  source:      'apple_health';
  data: {
    sleepDurationMin:  number | null;
    sleepEfficiency:   number | null;
    sleepSamples:      Array<{ startDate: string; endDate: string; value: string }>;
    hrv:               number | null;
    restingHR:         number | null;
    activeEnergyKcal:  number | null;
    stepCount:         number | null;
    collectedAt:       string;
  };
}

wearablesRouter.post('/sync', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const body   = req.body as AppleHealthPayload;

  if (!body?.source || !body?.data) {
    return res.status(400).json({ error: 'Missing source or data' });
  }

  const { source, data } = body;

  if (source === 'apple_health') {
    // Parse sleep onset/end from samples
    const asleepSamples = (data.sleepSamples ?? [])
      .filter(s => ['ASLEEP', 'DEEP', 'CORE', 'REM'].includes(s.value));

    const sleepOnset = asleepSamples.length
      ? asleepSamples.reduce((earliest, s) =>
          new Date(s.startDate) < new Date(earliest) ? s.startDate : earliest,
          asleepSamples[0].startDate)
      : null;

    const sleepEnd = asleepSamples.length
      ? asleepSamples.reduce((latest, s) =>
          new Date(s.endDate) > new Date(latest) ? s.endDate : latest,
          asleepSamples[0].endDate)
      : null;

    // Compute stage durations
    const stageDuration = (stage: string) => {
      return (data.sleepSamples ?? [])
        .filter(s => s.value === stage)
        .reduce((sum, s) => {
          return sum + Math.round(
            (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000
          );
        }, 0) || null;
    };

    const { error } = await supabase.from('wearable_data').insert({
      user_id:            userId,
      source:             'apple_health',
      collected_at:       data.collectedAt,
      sleep_duration_min: data.sleepDurationMin,
      sleep_efficiency:   data.sleepEfficiency,
      sleep_onset:        sleepOnset,
      sleep_end:          sleepEnd,
      rem_min:            stageDuration('REM'),
      deep_min:           stageDuration('DEEP'),
      light_min:          stageDuration('CORE'),
      awake_min:          stageDuration('AWAKE'),
      hrv_ms:             data.hrv,
      resting_hr:         data.restingHR,
      active_kcal:        data.activeEnergyKcal,
      step_count:         data.stepCount,
      raw_data:           data,
    });

    if (error) {
      console.error('[wearables/sync] insert error:', error.message);
      return res.status(500).json({ error: 'Failed to store wearable data' });
    }

    return res.json({ ok: true, source: 'apple_health' });
  }

  return res.status(400).json({ error: `Unsupported source: ${source}` });
});

// ─── GET /wearables/status ────────────────────────────────────────────────────

wearablesRouter.get('/status', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  const { data: tokens } = await supabase
    .from('wearable_tokens')
    .select('source, updated_at')
    .eq('user_id', userId);

  const { data: latest } = await supabase
    .from('wearable_data')
    .select('source, collected_at')
    .eq('user_id', userId)
    .order('collected_at', { ascending: false })
    .limit(10);

  const sourceMap: Record<string, { connected: boolean; lastSync: string | null }> = {
    apple_health: { connected: false, lastSync: null },
    oura:         { connected: false, lastSync: null },
    whoop:        { connected: false, lastSync: null },
  };

  // Mark OAuth sources as connected
  (tokens ?? []).forEach((t: any) => {
    if (sourceMap[t.source]) sourceMap[t.source].connected = true;
  });

  // Mark apple_health as connected if we have data
  (latest ?? []).forEach((row: any) => {
    if (sourceMap[row.source]) {
      sourceMap[row.source].connected = true;
      sourceMap[row.source].lastSync  = row.collected_at;
    }
  });

  return res.json({ ok: true, sources: sourceMap });
});

// ─── GET /wearables/latest ────────────────────────────────────────────────────

wearablesRouter.get('/latest', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  const { data, error } = await supabase
    .from('wearable_data')
    .select('source, collected_at, sleep_duration_min, sleep_efficiency, hrv_ms, resting_hr, readiness_score, strain_score')
    .eq('user_id', userId)
    .order('collected_at', { ascending: false })
    .limit(3);

  if (error) return res.status(500).json({ error: error.message });

  // Deduplicate by source (take most recent per source)
  const bySource: Record<string, any> = {};
  (data ?? []).forEach((row: any) => {
    if (!bySource[row.source]) bySource[row.source] = row;
  });

  return res.json({ ok: true, data: bySource });
});
