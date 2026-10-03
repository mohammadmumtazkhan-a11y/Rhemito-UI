/**
 * Device ID capture for the referral self-referral check.
 *
 * The browser sends a random ID in the X-Device-Id header. We validate it, hash it
 * (the raw value never leaves this server) and remember the latest device per customer.
 * rewardsService forwards it to the Mito Admin referral engine, which blocks a referral
 * when the referrer and the new customer share a device.
 */

import { createHash } from "crypto";
import type { NextFunction, Request, Response } from "express";

const DEVICE_ID_RE = /^[A-Za-z0-9-]{16,64}$/;

const deviceByUser = new Map<string, string>();

/** Hash a raw device ID, or return null when it is missing or malformed. */
export function hashDeviceId(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !DEVICE_ID_RE.test(value)) return null;
  return `dv_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

export function deviceIdFrom(req: Request): string | null {
  return hashDeviceId(req.headers["x-device-id"]);
}

/** Remember which device a customer is using right now. */
export function rememberDevice(userId: string, req: Request): void {
  const id = deviceIdFrom(req);
  if (id) deviceByUser.set(userId, id);
}

export function deviceForUser(userId: string): string | null {
  return deviceByUser.get(userId) ?? null;
}

/** Records the device for every request made while signed in. */
export function captureDevice(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (userId) rememberDevice(userId, req);
  next();
}

/** Test helper. */
export function _resetDevices(): void {
  deviceByUser.clear();
}
