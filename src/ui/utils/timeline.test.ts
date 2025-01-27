import { ZoomRegion, FocusRegion } from "ui/state/timeline";

import {
  filterToFocusRegion,
  getFormattedTime,
  getSecondsFromFormattedTime,
  getTimeFromPosition,
  isFocusRegionSubset,
  isValidTimeString,
  overlap,
} from "./timeline";

const point = (time: number) => ({ time, point: "" });
const focusRegion = (from: number, to: number): FocusRegion => ({
  start: point(from),
  startTime: from,
  end: point(to),
  endTime: to,
});

describe("getFormattedTime", () => {
  it("should properly format time with milliseconds", () => {
    expect(getFormattedTime(0, true)).toBe("0:00.000");
    expect(getFormattedTime(1_000, true)).toBe("0:01.000");
    expect(getFormattedTime(1_234, true)).toBe("0:01.234");
    expect(getFormattedTime(30_000, true)).toBe("0:30.000");
    expect(getFormattedTime(60_000, true)).toBe("1:00.000");
    expect(getFormattedTime(60_001, true)).toBe("1:00.001");
    expect(getFormattedTime(61_000, true)).toBe("1:01.000");
    expect(getFormattedTime(12_345, true)).toBe("0:12.345");
    expect(getFormattedTime(120_500, true)).toBe("2:00.500");
  });

  it("should properly format time without milliseconds", () => {
    expect(getFormattedTime(0, false)).toBe("0:00");
    expect(getFormattedTime(1_000, false)).toBe("0:01");
    expect(getFormattedTime(1_499, false)).toBe("0:01");
    expect(getFormattedTime(1_500, false)).toBe("0:02");
    expect(getFormattedTime(58_900, false)).toBe("0:59");
    expect(getFormattedTime(59_900, false)).toBe("1:00");
    expect(getFormattedTime(60_000, false)).toBe("1:00");
    expect(getFormattedTime(120_500, false)).toBe("2:01");
  });
});

describe("getSecondsFromFormattedTime", () => {
  it("should parse standalone seconds", () => {
    expect(getSecondsFromFormattedTime("0")).toBe(0);
    expect(getSecondsFromFormattedTime("1")).toBe(1_000);
    expect(getSecondsFromFormattedTime("60")).toBe(60_000);
    expect(getSecondsFromFormattedTime("61")).toBe(61_000);
  });

  it("should parse seconds and milliseconds", () => {
    expect(getSecondsFromFormattedTime("0.0")).toBe(0);
    expect(getSecondsFromFormattedTime("0.00")).toBe(0);
    expect(getSecondsFromFormattedTime("0.000")).toBe(0);
    expect(getSecondsFromFormattedTime("0.123")).toBe(123);
    expect(getSecondsFromFormattedTime("1.1")).toBe(1_100);
    expect(getSecondsFromFormattedTime("1.10")).toBe(1_100);
    expect(getSecondsFromFormattedTime("1.100")).toBe(1_100);
    expect(getSecondsFromFormattedTime("61.02")).toBe(61_020);
  });

  it("should parse minutes and seconds", () => {
    expect(getSecondsFromFormattedTime("0:00")).toBe(0);
    expect(getSecondsFromFormattedTime("0:01")).toBe(1_000);
    expect(getSecondsFromFormattedTime("0:10")).toBe(10_000);
    expect(getSecondsFromFormattedTime("1:00")).toBe(60_000);
    expect(getSecondsFromFormattedTime("1:01")).toBe(61_000);
    expect(getSecondsFromFormattedTime("1:11")).toBe(71_000);
  });

  it("should parse minutes, seconds, and milliseconds", () => {
    expect(getSecondsFromFormattedTime("0:00.0")).toBe(0);
    expect(getSecondsFromFormattedTime("0:00.00")).toBe(0);
    expect(getSecondsFromFormattedTime("0:00.000")).toBe(0);
    expect(getSecondsFromFormattedTime("0:01.0")).toBe(1_000);
    expect(getSecondsFromFormattedTime("0:10.50")).toBe(10_500);
    expect(getSecondsFromFormattedTime("1:00.050")).toBe(60_050);
    expect(getSecondsFromFormattedTime("1:01.009")).toBe(61_009);
  });

  it("should ignore leading and trailing spaces", () => {
    // Weird formatting to prevent linter from "fixing" the strings
    expect(getSecondsFromFormattedTime(" " + "61" + " ")).toBe(61_000);
    expect(getSecondsFromFormattedTime(" " + "61.02" + " ")).toBe(61_020);
    expect(getSecondsFromFormattedTime(" " + "1:11" + " ")).toBe(71_000);
    expect(getSecondsFromFormattedTime(" " + "1:01.009" + " ")).toBe(61_009);
  });

  it("should throw on invalidate format", () => {
    expect(() => getSecondsFromFormattedTime("a_61-b")).toThrow('Invalid format "a_61-b"');
    expect(() => getSecondsFromFormattedTime("a#61.02-b")).toThrow('Invalid format "a#61.02-b"');
    expect(() => getSecondsFromFormattedTime("/!1:11-b")).toThrow('Invalid format "/!1:11-b"');
    expect(() => getSecondsFromFormattedTime("?1:01.009-C")).toThrow(
      'Invalid format "?1:01.009-C"'
    );
  });
});

describe("getTimeFromPosition", () => {
  const RECT = {
    left: 50,
    width: 100,
  };

  const ZOOM_REGION: ZoomRegion = {
    startTime: 0,
    endTime: 1000,
    scale: 1,
  };

  it("should calculate the right relative time", () => {
    expect(getTimeFromPosition(50, RECT, ZOOM_REGION)).toBe(0);
    expect(getTimeFromPosition(75, RECT, ZOOM_REGION)).toBe(250);
    expect(getTimeFromPosition(100, RECT, ZOOM_REGION)).toBe(500);
    expect(getTimeFromPosition(125, RECT, ZOOM_REGION)).toBe(750);
    expect(getTimeFromPosition(150, RECT, ZOOM_REGION)).toBe(1000);
  });

  it("should properly clamp times", () => {
    expect(getTimeFromPosition(0, RECT, ZOOM_REGION)).toBe(0);
    expect(getTimeFromPosition(25, RECT, ZOOM_REGION)).toBe(0);
    expect(getTimeFromPosition(175, RECT, ZOOM_REGION)).toBe(1000);
    expect(getTimeFromPosition(200, RECT, ZOOM_REGION)).toBe(1000);
  });
});

describe("isFocusRegionSubset", () => {
  it("should always be true when previous focus region was null", () => {
    expect(isFocusRegionSubset(null, null)).toBe(true);
    expect(isFocusRegionSubset(null, focusRegion(0, 0))).toBe(true);
    expect(isFocusRegionSubset(null, focusRegion(0, 1000))).toBe(true);
    expect(isFocusRegionSubset(null, focusRegion(1000, 1000))).toBe(true);
  });

  it("should never be true when new focus region was null (unless previous one was also)", () => {
    expect(isFocusRegionSubset(focusRegion(0, 0), null)).toBe(false);
    expect(isFocusRegionSubset(focusRegion(0, 1000), null)).toBe(false);
    expect(isFocusRegionSubset(focusRegion(1000, 1000), null)).toBe(false);
  });

  it("should correctly differentiate between overlapping and non-overlapping focus regions", () => {
    expect(isFocusRegionSubset(focusRegion(0, 0), focusRegion(0, 0))).toBe(true);
    expect(isFocusRegionSubset(focusRegion(100, 200), focusRegion(0, 50))).toBe(false);
    expect(isFocusRegionSubset(focusRegion(100, 200), focusRegion(50, 150))).toBe(false);
    expect(isFocusRegionSubset(focusRegion(100, 200), focusRegion(100, 200))).toBe(true);
    expect(isFocusRegionSubset(focusRegion(100, 200), focusRegion(125, 175))).toBe(true);
    expect(isFocusRegionSubset(focusRegion(100, 200), focusRegion(150, 250))).toBe(false);
    expect(isFocusRegionSubset(focusRegion(100, 200), focusRegion(200, 300))).toBe(false);
  });
});
describe("isValidTimeString", () => {
  it("should recognized valid time strings", () => {
    expect(isValidTimeString("0")).toBe(true);
    expect(isValidTimeString("0:00")).toBe(true);
    expect(isValidTimeString("0:00.0")).toBe(true);
    expect(isValidTimeString("1")).toBe(true);
    expect(isValidTimeString("1:23")).toBe(true);
    expect(isValidTimeString("1:23.4")).toBe(true);
    expect(isValidTimeString("12:34.5")).toBe(true);
    expect(isValidTimeString("12:34.56")).toBe(true);
    expect(isValidTimeString("12:34.57")).toBe(true);
    expect(isValidTimeString("1.2")).toBe(true);
    expect(isValidTimeString("1.23")).toBe(true);
    expect(isValidTimeString("1.234")).toBe(true);
  });

  it("should recognized invalid time strings", () => {
    expect(isValidTimeString("0:0:0")).toBe(false);
    expect(isValidTimeString("0.0.0")).toBe(false);
    expect(isValidTimeString("0:0.0:0")).toBe(false);
    expect(isValidTimeString("a")).toBe(false);
    expect(isValidTimeString("a.a")).toBe(false);
    expect(isValidTimeString("1.a")).toBe(false);
    expect(isValidTimeString("a.1")).toBe(false);
    expect(isValidTimeString("a:1")).toBe(false);
    expect(isValidTimeString("a:b")).toBe(false);
    expect(isValidTimeString("1:b")).toBe(false);
  });
});

describe("overlap", () => {
  const point = (time: number) => {
    return { point: "", time };
  };

  const range = (begin: number, end: number) => {
    return {
      begin: point(begin),
      end: point(end),
    };
  };

  it("correctly merges overlapping regions when the second begins during the first", () => {
    expect(overlap([range(0, 5)], [range(2, 7)])).toStrictEqual([range(2, 5)]);
  });

  it("correctly merges overlapping regions when the first begins during the second", () => {
    expect(overlap([range(2, 7)], [range(0, 5)])).toStrictEqual([range(2, 5)]);
  });

  it("leaves non-overlapping regions alone", () => {
    expect(overlap([range(0, 2)], [range(3, 5)])).toStrictEqual([]);
  });

  it("does not blow up with empty inputs", () => {
    expect(overlap([range(0, 2)], [])).toStrictEqual([]);
    expect(overlap([], [range(0, 2)])).toStrictEqual([]);
  });
});

describe("filterToFocusRegion", () => {
  it("will not include points before the region", () => {
    expect(filterToFocusRegion([point(5)], focusRegion(10, 20))).toEqual([]);
  });
  it("will not include points after the region", () => {
    expect(filterToFocusRegion([point(25)], focusRegion(10, 20))).toEqual([]);
  });
  it("will include points inside the region", () => {
    expect(filterToFocusRegion([point(5), point(15), point(25)], focusRegion(10, 20))).toEqual([
      point(15),
    ]);
  });
  it("will include points on the boundaries the region", () => {
    expect(filterToFocusRegion([point(10), point(15), point(20)], focusRegion(10, 20))).toEqual([
      point(10),
      point(15),
      point(20),
    ]);
  });
});
