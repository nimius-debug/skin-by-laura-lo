// Loads a client's orders through the copy stored in D1. Square stays the source
// of truth: the copy is used while it is under an hour old, then replaced from
// Square. If Square can't be read, the stored copy is used instead of failing.

import { isConfigured } from "../square.js";
import { fetchClientOrders } from "./routine.js";
import * as db from "./db.js";

const FRESH_MINUTES = 60;

/**
 * Returns { orders, syncedAt, source }:
 *   "none"          no Square customer, or Square isn't connected
 *   "stored"        the stored copy, still fresh
 *   "square"        just re-read from Square (and stored)
 *   "stored-stale"  Square couldn't be read, so an older stored copy is used
 * Throws only when there is no stored copy and Square can't be read.
 * `refresh` skips the freshness check (the "Refresh from Square" link).
 */
export async function loadClientOrders(env, client, { refresh = false, now = Date.now() } = {}) {
  if (!client.square_customer_id || !isConfigured(env)) return { orders: [], syncedAt: null, source: "none" };

  const stored = await db.getStoredOrders(env, client.id);
  if (stored && !refresh && now - Date.parse(stored.syncedAt) < FRESH_MINUTES * 60 * 1000) {
    return { ...stored, source: "stored" };
  }

  try {
    const orders = await fetchClientOrders(env, client.square_customer_id);
    await db.replaceStoredOrders(env, client.id, orders);
    return { orders, syncedAt: new Date(now).toISOString(), source: "square" };
  } catch (error) {
    if (!stored) throw error;
    console.error("Square unreachable, using the stored orders:", error.message);
    return { ...stored, source: "stored-stale" };
  }
}
