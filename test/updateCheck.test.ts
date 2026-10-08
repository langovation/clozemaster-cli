import { afterEach, describe, expect, it, vi } from "vitest";
import open from "open";
import { openFeedbackEmail } from "../src/feedback.js";
import { currentVersion, fetchNewerVersion, isNewerVersion } from "../src/updateCheck.js";

vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));

describe("isNewerVersion", () => {
  it.each([
    ["0.2.0", "0.1.9"],
    ["1.0.0", "0.9.9"],
    ["0.1.10", "0.1.9"],
    ["0.1.1", "0.1"],
  ])("knows %s is newer than %s", (candidate, current) => {
    expect(isNewerVersion(candidate, current)).toBe(true);
  });

  it.each([
    ["0.1.0", "0.1.0"],
    ["0.1.0", "0.2.0"],
    ["0.9.9", "1.0.0"],
  ])("knows %s isn't newer than %s", (candidate, current) => {
    expect(isNewerVersion(candidate, current)).toBe(false);
  });
});

describe("fetchNewerVersion", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubVersionFile(response: Response | Error) {
    vi.stubGlobal("fetch", vi.fn(async () => (response instanceof Error ? Promise.reject(response) : response)));
  }

  it("returns the published version when it's newer", async () => {
    stubVersionFile(new Response("99.0.0\n"));
    expect(await fetchNewerVersion()).toBe("99.0.0");
  });

  it("returns nothing when this is the published version", async () => {
    stubVersionFile(new Response(currentVersion));
    expect(await fetchNewerVersion()).toBeUndefined();
  });

  it("returns nothing when the version file is missing", async () => {
    stubVersionFile(new Response("", { status: 404 }));
    expect(await fetchNewerVersion()).toBeUndefined();
  });

  it("returns nothing when offline", async () => {
    stubVersionFile(new TypeError("fetch failed"));
    expect(await fetchNewerVersion()).toBeUndefined();
  });
});

describe("openFeedbackEmail", () => {
  it("opens an email to support", async () => {
    await openFeedbackEmail();
    expect(open).toHaveBeenCalledWith("mailto:support@clozemaster.com?subject=Clozemaster%20CLI%20feedback");
  });

  it("ignores a failure to open the mail client", async () => {
    vi.mocked(open).mockRejectedValueOnce(new Error("no mail client"));
    await expect(openFeedbackEmail()).resolves.toBeUndefined();
  });
});
