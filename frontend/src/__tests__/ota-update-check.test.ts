import { renderHook, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";
import { useOtaUpdateCheck } from "../features/app-update/hooks/use-ota-update-check";
import { useAppUpdateStore } from "../features/app-update/store";

jest.mock("expo-updates", () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const mockUpdates = Updates as jest.Mocked<typeof Updates>;

const MINUTE = 60 * 1000;

/** Drives the AppState listener the hook registers, with a controllable clock. */
function setup() {
  let now = 10 * MINUTE;
  jest.spyOn(Date, "now").mockImplementation(() => now);

  let listener: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, cb) => {
    listener = cb as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });

  renderHook(() => useOtaUpdateCheck(true));

  return {
    advance: (ms: number) => { now += ms; },
    send: (state: AppStateStatus) => listener?.(state),
  };
}

const otaReady = () => useAppUpdateStore.getState().otaReady;

beforeEach(() => {
  jest.clearAllMocks();
  useAppUpdateStore.setState({ otaReady: false, otaDismissed: false });
  mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false } as never);
  mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: true } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useOtaUpdateCheck", () => {
  it("fetches and flags the update on mount, without reloading", async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as never);
    setup();

    await waitFor(() => expect(otaReady()).toBe(true));
    expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalled();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  it("checks again on foreground once the cooldown has passed", async () => {
    const { advance, send } = setup();
    await waitFor(() => expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1));

    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as never);
    send("background");
    advance(2 * MINUTE);
    send("active");

    await waitFor(() => expect(otaReady()).toBe(true));
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(2);
  });

  it("skips the check within the cooldown", async () => {
    const { advance, send } = setup();
    await waitFor(() => expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1));

    send("background");
    advance(10 * 1000);
    send("active");

    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it("does not flag anything when no update is available", async () => {
    setup();

    await waitFor(() => expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalled());
    expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(otaReady()).toBe(false);
  });

  it("stops checking once the user said later", async () => {
    useAppUpdateStore.getState().dismissOta();
    const { advance, send } = setup();

    send("background");
    advance(2 * MINUTE);
    send("active");

    expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it("swallows check failures so a flaky network never breaks resume", async () => {
    mockUpdates.checkForUpdateAsync.mockRejectedValue(new Error("offline"));
    setup();

    await waitFor(() => expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalled());
    expect(otaReady()).toBe(false);
  });
});
