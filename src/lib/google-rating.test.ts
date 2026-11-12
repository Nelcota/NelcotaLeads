import { describe, expect, it } from "vitest";
import { googleRatingLabel } from "./google-rating";

describe("googleRatingLabel", () => {
  it("shows the rating with a comma and the review count", () => {
    expect(googleRatingLabel(4.2, 38)).toBe("4,2 (38 avaliações)");
  });

  it("uses the singular for one review and keeps zero plural", () => {
    expect(googleRatingLabel(5, 1)).toBe("5,0 (1 avaliação)");
    expect(googleRatingLabel(3, 0)).toBe("3,0 (0 avaliações)");
  });

  it("groups thousands the Brazilian way", () => {
    expect(googleRatingLabel(4.6, 12345)).toBe("4,6 (12.345 avaliações)");
  });

  it("leaves the count out when it is unknown or invalid", () => {
    expect(googleRatingLabel(4.2, null)).toBe("4,2");
    expect(googleRatingLabel(4.2, Number.NaN)).toBe("4,2");
    expect(googleRatingLabel(4.2, -3)).toBe("4,2");
  });
});
