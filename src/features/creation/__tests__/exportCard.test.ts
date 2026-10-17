import { describe, expect, it } from "vitest";
import { cardFileName, formatTimestamp } from "../exportCard";
import type { CreationDraft } from "@/domain/entities/types";

describe("cardFileName and formatTimestamp", () => {
  it("formats date into yyyymmdd_hhmmss format", () => {
    const fixedDate = new Date(2026, 9, 17, 7, 15, 30); // October 17, 2026 07:15:30
    expect(formatTimestamp(fixedDate)).toBe("20261017_071530");
  });

  it("generates filenames matching dearly-studio_<yyyymmdd_hhmmss>.png", () => {
    const draft = {
      title: "Unsplash beautiful sunset in mountains",
    } as CreationDraft;

    const fileName = cardFileName(draft, "png");
    expect(fileName).toMatch(/^dearly-studio_\d{8}_\d{6}\.png$/);
  });

  it("generates filenames with pdf extension matching dearly-studio_<yyyymmdd_hhmmss>.pdf", () => {
    const fileName = cardFileName(undefined, "pdf");
    expect(fileName).toMatch(/^dearly-studio_\d{8}_\d{6}\.pdf$/);
  });
});
