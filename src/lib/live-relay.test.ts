import { describe, expect, it, vi, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), connectLive: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.getUser } } }));
vi.mock("@lovable.dev/ai-gateway", () => ({ connectLive: mocks.connectLive, streamResponse: vi.fn() }));
import { bindLiveConnection, getLiveConfig, validateLiveUpgrade, type LiveSocket } from "./live-relay.server";

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe("voice access", () => {
  it("rejects cross-origin upgrades", () => {
    const request = new Request("https://app.example/api/live", { headers: { origin: "https://other.example", upgrade: "websocket" } });
    expect(validateLiveUpgrade(request)?.status).toBe(403);
  });
  it("only permits missing origin for development", () => {
    const request = new Request("https://app.example/api/live", { headers: { upgrade: "websocket" } });
    expect(validateLiveUpgrade(request)?.status).toBe(403);
    expect(validateLiveUpgrade(request, { allowMissingOrigin: true })).toBeNull();
  });
  it("requires login before opening a paid voice session", async () => {
    vi.useFakeTimers();
    let receive: ((data: unknown) => void) | undefined;
    const tasks: Promise<unknown>[] = [];
    const socket: LiveSocket = { readyState: 1, send: vi.fn(), close: vi.fn(), onMessage: fn => { receive = fn; }, onClose: vi.fn(), onError: vi.fn() };
    bindLiveConnection(socket, getLiveConfig(), { waitUntil: task => tasks.push(task) });
    receive?.(JSON.stringify({ type: "app.start", sdp: "offer" }));
    await Promise.all(tasks);
    expect(mocks.connectLive).not.toHaveBeenCalled();
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining("লগইন"));
    expect(socket.close).toHaveBeenCalled();
  });
  it("does not start a late authenticated call after Stop", async () => {
    vi.useFakeTimers();
    let resolveAuth: ((value: { data: { user: { id: string } }; error: null }) => void) | undefined;
    mocks.getUser.mockImplementation(() => new Promise(resolve => { resolveAuth = resolve; }));
    let receive: ((data: unknown) => void) | undefined;
    const tasks: Promise<unknown>[] = [];
    const socket: LiveSocket = { readyState: 1, send: vi.fn(), close: vi.fn(), onMessage: fn => { receive = fn; }, onClose: vi.fn(), onError: vi.fn() };
    bindLiveConnection(socket, getLiveConfig(), { waitUntil: task => tasks.push(task) });
    receive?.(JSON.stringify({ type: "app.start", sdp: "offer", accessToken: "test-token" }));
    receive?.(JSON.stringify({ type: "session.close" }));
    resolveAuth?.({ data: { user: { id: "test-user" } }, error: null });
    await Promise.all(tasks);
    expect(mocks.connectLive).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalled();
  });
});