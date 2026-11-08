import { describe, expect, it } from "vitest";
import {
  caretAfter,
  decimalDotToComma,
  maskMoney,
  maskWholeNumber,
  moneyAfterEdit,
  significantBefore,
} from "./number-mask";

describe("maskWholeNumber", () => {
  it("groups thousands with dots as the person types", () => {
    expect(maskWholeNumber("1")).toBe("1");
    expect(maskWholeNumber("1000")).toBe("1.000");
    expect(maskWholeNumber("1.0000")).toBe("10.000");
    expect(maskWholeNumber("1234567")).toBe("1.234.567");
  });

  it("drops letters, signs and leading zeros", () => {
    expect(maskWholeNumber("a1b2-3")).toBe("123");
    expect(maskWholeNumber("007")).toBe("7");
    expect(maskWholeNumber("0")).toBe("0");
    expect(maskWholeNumber("")).toBe("");
  });

  it("stops at nine digits", () => {
    expect(maskWholeNumber("12345678901")).toBe("123.456.789");
  });
});

describe("maskMoney", () => {
  it("groups the reais and keeps up to two cents after the comma", () => {
    expect(maskMoney("150000")).toBe("150.000");
    expect(maskMoney("1500,")).toBe("1.500,");
    expect(maskMoney("1500,5")).toBe("1.500,5");
    expect(maskMoney("1.500,507")).toBe("1.500,50");
    expect(maskMoney(",5")).toBe("0,5");
  });

  it("reads dots as thousands separators", () => {
    expect(maskMoney("1.234")).toBe("1.234");
    expect(maskMoney("1.00")).toBe("100");
  });

  it("keeps a single comma", () => {
    expect(maskMoney("1,2,3")).toBe("1,23");
  });
});

describe("moneyAfterEdit", () => {
  it("takes a dot typed or pasted for the cents as the comma", () => {
    expect(maskMoney(moneyAfterEdit("1.500", "1500.50"))).toBe("1.500,50");
    expect(maskMoney(moneyAfterEdit("1.500", "1.500."))).toBe("1.500,");
    expect(maskMoney(moneyAfterEdit("12", "12.5"))).toBe("12,5");
  });

  it("keeps grouping dots when a digit is deleted", () => {
    expect(maskMoney(moneyAfterEdit("1.000", "1.00"))).toBe("100");
    expect(maskMoney(moneyAfterEdit("15.000", "15.00"))).toBe("1.500");
    expect(maskMoney(moneyAfterEdit("1.500", "1.00"))).toBe("100");
  });
});

describe("decimalDotToComma", () => {
  it("only turns a last dot with up to two digits into the comma", () => {
    expect(decimalDotToComma("12.5")).toBe("12,5");
    expect(decimalDotToComma("12.345")).toBe("12.345");
    expect(decimalDotToComma("1.234,5")).toBe("1.234,5");
  });
});

describe("caret", () => {
  it("keeps its place among digits when dots are added", () => {
    // "1000|" typed: four digits before the caret land after the last digit of "1.000".
    expect(caretAfter("1.000", significantBefore("1000", 4))).toBe(5);
    // Caret after the first digit of "10000" stays after "1" in "10.000".
    expect(caretAfter("10.000", significantBefore("10000", 1))).toBe(1);
    expect(caretAfter("1.000", 0)).toBe(0);
  });
});
