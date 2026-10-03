import { describe, it, expect, beforeEach, vi } from "vitest";
import { getDeviceId, installDeviceIdHeader, DEVICE_ID_HEADER } from "@/lib/deviceId";
import { hashDeviceId, rememberDevice, deviceForUser, captureDevice, _resetDevices } from "../../../server/deviceId";

describe("client device ID", () => {
  beforeEach(() => localStorage.clear());

  it("creates an ID once and keeps it", () => {
    const first = getDeviceId();
    expect(first).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    expect(getDeviceId()).toBe(first);
    expect(localStorage.getItem("rhemito.deviceId")).toBe(first);
  });

  it("adds the header to our own API calls only", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("{}"));
    window.fetch = spy as unknown as typeof window.fetch;
    installDeviceIdHeader();

    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" } });
    const own = new Headers(spy.mock.calls[0][1].headers);
    expect(own.get(DEVICE_ID_HEADER)).toBe(getDeviceId());
    expect(own.get("Content-Type")).toBe("application/json");

    await fetch("https://example.com/api/x");
    expect(spy.mock.calls[1][1]?.headers).toBeUndefined();
  });
});

describe("server device ID", () => {
  beforeEach(() => _resetDevices());
  const req = (id?: string, userId?: string) => ({ headers: id ? { "x-device-id": id } : {}, session: { userId } }) as never;

  it("hashes valid IDs and rejects bad ones", () => {
    const hashed = hashDeviceId("1234567890abcdef");
    expect(hashed).toMatch(/^dv_[0-9a-f]{32}$/);
    expect(hashed).toBe(hashDeviceId("1234567890abcdef"));
    expect(hashed).not.toContain("1234567890abcdef");
    expect(hashDeviceId("short")).toBeNull();
    expect(hashDeviceId("has spaces and <script>!!")).toBeNull();
    expect(hashDeviceId(undefined)).toBeNull();
  });

  it("remembers the latest device per customer and ignores missing headers", () => {
    rememberDevice("u1", req("aaaaaaaaaaaaaaaa"));
    const first = deviceForUser("u1");
    rememberDevice("u1", req());
    expect(deviceForUser("u1")).toBe(first);
    rememberDevice("u1", req("bbbbbbbbbbbbbbbb"));
    expect(deviceForUser("u1")).not.toBe(first);
  });

  it("middleware records the device only when signed in", () => {
    const next = vi.fn();
    captureDevice(req("cccccccccccccccc"), {} as never, next);
    captureDevice(req("cccccccccccccccc", "u2"), {} as never, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(deviceForUser("u2")).toMatch(/^dv_/);
  });

  it("gives two customers on one browser the same device value", () => {
    rememberDevice("referrer", req("dddddddddddddddd"));
    rememberDevice("friend", req("dddddddddddddddd"));
    expect(deviceForUser("referrer")).toBe(deviceForUser("friend"));
  });
});
