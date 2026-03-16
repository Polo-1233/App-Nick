/**
 * oura.ts — Oura Ring OAuth connect flow (app side)
 *
 * Opens the Oura consent URL in a WebBrowser,
 * then deep link `r90://wearables/oura?status=connected` closes the flow.
 */

import * as WebBrowser from 'expo-web-browser';
import { BASE_URL } from './api';
import { getAccessToken } from './supabase';

export async function connectOura(): Promise<'connected' | 'cancelled' | 'error'> {
  try {
    const token = await getAccessToken();
    const res   = await fetch(`${BASE_URL}/wearables/oura/connect`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return 'error';

    const { url } = await res.json() as { url: string };

    const result = await WebBrowser.openAuthSessionAsync(url, 'r90://wearables/oura');

    if (result.type === 'success') {
      const status = new URL(result.url).searchParams.get('status');
      return status === 'connected' ? 'connected' : 'error';
    }
    return 'cancelled';
  } catch {
    return 'error';
  }
}

export async function disconnectOura(): Promise<boolean> {
  try {
    const token = await getAccessToken();
    const res   = await fetch(`${BASE_URL}/wearables/oura/disconnect`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncOura(): Promise<boolean> {
  try {
    const token = await getAccessToken();
    const res   = await fetch(`${BASE_URL}/wearables/oura/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
