import type { Env } from './core-utils';
import {
  VendorEntity,
  CollaborationBridgeEntity,
  ServiceNowConfigEntity,
  SolarWindsConfigEntity,
  UserEntity,
  ChatBoardEntity,
} from './entities';

async function kvGet(env: Env, key: string): Promise<string | null> {
  try {
    if (env.KV && typeof env.KV.get === 'function') {
      return await env.KV.get(key);
    }
  } catch {
    // best-effort; fall back to env
  }
  const raw = (env as any)[key];
  return typeof raw === 'string' ? raw : null;
}

async function kvGetBool(env: Env, key: string): Promise<boolean> {
  const raw = await kvGet(env, key);
  const v = String(raw ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

async function isDemoMode(env: Env): Promise<boolean> {
  return kvGetBool(env, 'DEMO_MODE');
}

function isEtMidnight(now: Date): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  return hour === '00' && minute === '00';
}

async function resetIndexed<T extends { id: string }>(
  env: Env,
  listFn: (env: Env) => Promise<{ items: T[] }>,
  deleteManyFn: (env: Env, ids: string[]) => Promise<number>,
  label: string
) {
  const { items } = await listFn(env);
  const ids = items.map((item) => item.id).filter(Boolean);
  if (ids.length === 0) return;
  const removed = await deleteManyFn(env, ids);
  console.log(`[demo-reset] Cleared ${removed} ${label}`);
}

export async function resetDemoData(env: Env): Promise<void> {
  if (!(await isDemoMode(env))) return;
  if (!isEtMidnight(new Date())) return;

  await resetIndexed(env, VendorEntity.list, VendorEntity.deleteMany, 'vendors');
  await resetIndexed(env, CollaborationBridgeEntity.list, CollaborationBridgeEntity.deleteMany, 'collaboration bridges');
  await resetIndexed(env, UserEntity.list, UserEntity.deleteMany, 'users');
  await resetIndexed(env, ChatBoardEntity.list, ChatBoardEntity.deleteMany, 'chats');

  const serviceNow = new ServiceNowConfigEntity(env);
  await serviceNow.save(ServiceNowConfigEntity.initialState);
  const solarWinds = new SolarWindsConfigEntity(env);
  await solarWinds.save(SolarWindsConfigEntity.initialState);

  console.log('[demo-reset] Reset ServiceNow/SolarWinds config to defaults');
}
