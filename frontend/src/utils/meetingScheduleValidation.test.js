import { describe, it, expect, afterEach, vi } from "vitest";
import {
  meetingDatetimeLocalToDate,
  validateMeetingScheduleLocal,
} from "./meetingScheduleValidation";

describe("meetingScheduleValidation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses datetime-local as local wall time", () => {
    const d = meetingDatetimeLocalToDate("2026-06-15T14:30");
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it("rejects invalid calendar dates", () => {
    expect(meetingDatetimeLocalToDate("2026-02-30T10:00")).toBeNull();
  });

  it("requires proposed local instant to be strictly after Date.now()", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 15, 0, 0));
    expect(validateMeetingScheduleLocal("2026-04-19T10:00").ok).toBe(false);
    expect(validateMeetingScheduleLocal("2026-04-20T14:59").ok).toBe(false);
    expect(validateMeetingScheduleLocal("2026-04-20T15:00").ok).toBe(false);
    expect(validateMeetingScheduleLocal("2026-04-20T15:01").ok).toBe(true);
  });
});
