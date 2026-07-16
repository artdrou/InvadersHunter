import { renderHook, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";
import { useOtaReload } from "../features/app-update/hooks/use-ota-reload";

jest.mock("expo-updates", () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

const mockUpdates = Updates as jest.Mocked<typeof Updates>;

const MINUTE = 60 * 1000;

/** Drives the AppState listener the hook registers, with a controllable clock. */
function setup() {
  let now = 0;
  jest.spyOn(Date, "now").mockImplementation(() => now);

  let listener: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, cb) => {
    listener = cb as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });

  renderHook(() => useOtaReload(true));

  return {
    advance: (ms: number) => { now += ms; },
    send: (state: AppStateStatus) => listener?.(state),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false } as never);
  mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: true } as never);
  mockUpdates.reloadAsync.mockResolvedValue(undefined as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useOtaReload", () => {
  it("fetches and reloads when an update is available after a long background", async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as never);
    const { advance, send } = setup();

    send("background");
    advance(4 * MINUTE); // past the 3 min threshold
    send("active");

    await waitFor(() => expect(mockUpdates.reloadAsync).toHaveBeenCalled());
    expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalled();
  });

  it("does not reload after a quick app-switch", async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as never);
    const { advance, send } = setup();

    send("background");
    advance(10 * 1000); // 10s — well under the threshold
    send("active");

    await waitFor(() => expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled());
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  it("checks but does not reload when no update is available", async () => {
    const { advance, send } = setup();

    send("background");
    advance(4 * MINUTE);
    send("active");

    await waitFor(() => expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalled());
    expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  it("never reloads on a cold start (no preceding background)", async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as never);
    const { send } = setup();

    send("active");

    await waitFor(() => expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled());
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  it("swallows check failures so a flaky network never breaks resume", async () => {
    mockUpdates.checkForUpdateAsync.mockRejectedValue(new Error("offline"));
    const { advance, send } = setup();

    send("background");
    advance(4 * MINUTE);
    send("active");

    await waitFor(() => expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalled());
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });
});
