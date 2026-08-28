import { describe, expect, it } from "vitest";
import {
  COUNTRY_CURRENCY,
  SERVICE_TYPES,
  bankFieldsFor,
  currencyForCountry,
  displayName,
  generateUniqueCode,
  initials,
  paginateRecipients,
  requiresNarration,
  searchRecipients,
  serviceTypeStyle,
  sortRecipients,
} from "@/lib/recipients";
import { knownRecipients, type KnownRecipient } from "@/data/recipients";

const makeRecipient = (overrides: Partial<KnownRecipient>): KnownRecipient => ({
  id: "rec-test",
  recipientType: "individual",
  firstName: "Ada",
  lastName: "Obi",
  businessName: "",
  country: "Nigeria",
  currency: "NGN",
  bankName: "GTBank",
  accountNumber: "0123456789",
  sortCode: "",
  iban: "",
  swift: "",
  serviceType: "Bank Deposit",
  uniqueCode: "111111",
  narration: "",
  relationship: "Personal",
  createdAt: "2026-01-01",
  ...overrides,
});

describe("currencyForCountry", () => {
  it("maps supported receiving countries to payout currencies", () => {
    expect(currencyForCountry("Nigeria")).toBe("NGN");
    expect(currencyForCountry("United Kingdom")).toBe("GBP");
    expect(currencyForCountry("Germany")).toBe("EUR");
    expect(currencyForCountry("United Arab Emirates")).toBe("AED");
  });

  it("falls back to USD for unknown countries", () => {
    expect(currencyForCountry("Brazil")).toBe("USD");
    expect(COUNTRY_CURRENCY).toHaveProperty("Kenya", "KES");
  });
});

describe("bankFieldsFor", () => {
  it("requires a sort code for the UK", () => {
    expect(bankFieldsFor("United Kingdom")).toEqual({
      sortCode: true,
      iban: false,
      swift: false,
    });
  });

  it("requires an IBAN for EUR countries", () => {
    expect(bankFieldsFor("France").iban).toBe(true);
    expect(bankFieldsFor("Germany").iban).toBe(true);
  });

  it("requires SWIFT for international corridors", () => {
    expect(bankFieldsFor("United States").swift).toBe(true);
    expect(bankFieldsFor("China").swift).toBe(true);
    expect(bankFieldsFor("United Arab Emirates").swift).toBe(true);
  });

  it("needs no routing field for local-account corridors", () => {
    expect(bankFieldsFor("Nigeria")).toEqual({
      sortCode: false,
      iban: false,
      swift: false,
    });
  });
});

describe("requiresNarration", () => {
  it("is mandatory only for Nigerian beneficiaries", () => {
    expect(requiresNarration("Nigeria")).toBe(true);
    expect(requiresNarration("United Kingdom")).toBe(false);
    expect(requiresNarration("Kenya")).toBe(false);
  });
});

describe("displayName and initials", () => {
  it("joins first and last name for individuals", () => {
    expect(displayName(makeRecipient({}))).toBe("Ada Obi");
    expect(initials(makeRecipient({}))).toBe("AO");
  });

  it("uses the business name for business recipients", () => {
    const business = makeRecipient({
      recipientType: "business",
      firstName: "",
      lastName: "",
      businessName: "Chen Logistics Ltd",
    });
    expect(displayName(business)).toBe("Chen Logistics Ltd");
    expect(initials(business)).toBe("CH");
  });

  it("does not crash on empty names", () => {
    expect(initials(makeRecipient({ firstName: "", lastName: "" }))).toBe("");
  });
});

describe("serviceTypeStyle", () => {
  it("styles every supported service type", () => {
    for (const type of SERVICE_TYPES) {
      const style = serviceTypeStyle(type);
      expect(style.pillClass).toContain("border");
      expect(style.dotClass).toMatch(/^bg-(blue|purple|teal)-500$/);
    }
  });

  it("falls back to the bank deposit style for unknown types", () => {
    expect(serviceTypeStyle("Bank Deposit")).toEqual(serviceTypeStyle("Unknown"));
  });
});

describe("searchRecipients", () => {
  it("returns everything for an empty query", () => {
    expect(searchRecipients(knownRecipients, "")).toEqual(knownRecipients);
    expect(searchRecipients(knownRecipients, "   ")).toEqual(knownRecipients);
  });

  it("matches names case-insensitively", () => {
    const results = searchRecipients(knownRecipients, "ngozi");
    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe("Ngozi");
  });

  it("matches countries", () => {
    const results = searchRecipients(knownRecipients, "kenya");
    expect(results).toHaveLength(1);
    expect(results[0].country).toBe("Kenya");
  });

  it("matches business names", () => {
    const results = searchRecipients(knownRecipients, "chen logistics");
    expect(results).toHaveLength(1);
    expect(results[0].recipientType).toBe("business");
  });

  it("returns nothing for an unknown term", () => {
    expect(searchRecipients(knownRecipients, "zzz-not-a-name")).toEqual([]);
  });
});

describe("sortRecipients", () => {
  it("sorts by name in both directions", () => {
    const asc = sortRecipients(knownRecipients, "name", "asc");
    const desc = sortRecipients(knownRecipients, "name", "desc");
    expect(asc.map(displayName)).toEqual([...knownRecipients]
      .map(displayName)
      .sort((a, b) => a.localeCompare(b)));
    expect(desc.map(displayName)).toEqual([...asc].reverse().map(displayName));
  });

  it("sorts by country and service type", () => {
    const byCountry = sortRecipients(knownRecipients, "country", "asc");
    expect(byCountry[0].country).toBe("China");
    const byService = sortRecipients(knownRecipients, "serviceType", "asc");
    expect(byService.map((r) => r.serviceType)).toEqual(
      [...byService].map((r) => r.serviceType).sort((a, b) => a.localeCompare(b))
    );
  });

  it("sorts newest first for createdAt desc", () => {
    const newestFirst = sortRecipients(knownRecipients, "createdAt", "desc");
    expect(newestFirst[0].createdAt).toBe("2026-08-12");
  });

  it("does not mutate the input array", () => {
    const input = [...knownRecipients];
    sortRecipients(knownRecipients, "name", "desc");
    expect(knownRecipients).toEqual(input);
  });
});

describe("paginateRecipients", () => {
  it("slices rows to the requested page and size", () => {
    const result = paginateRecipients(knownRecipients, 1, 10);
    expect(result.rows).toHaveLength(10);
    expect(result.total).toBe(knownRecipients.length);
    expect(result.totalPages).toBe(2);
    expect(result.start).toBe(1);
    expect(result.end).toBe(10);
  });

  it("shows the remainder on the last page", () => {
    const result = paginateRecipients(knownRecipients, 2, 10);
    expect(result.rows).toHaveLength(knownRecipients.length - 10);
    expect(result.start).toBe(11);
    expect(result.end).toBe(knownRecipients.length);
  });

  it("clamps out-of-range page numbers", () => {
    expect(paginateRecipients(knownRecipients, 99, 10).safePage).toBe(2);
    expect(paginateRecipients(knownRecipients, 0, 10).safePage).toBe(1);
  });

  it("handles an empty list without dividing by zero", () => {
    const result = paginateRecipients([], 1, 10);
    expect(result.totalPages).toBe(1);
    expect(result.rows).toEqual([]);
    expect(result.start).toBe(0);
    expect(result.end).toBe(0);
  });
});

describe("generateUniqueCode", () => {
  it("produces a 6-digit numeric code", () => {
    expect(generateUniqueCode([])).toMatch(/^\d{6}$/);
  });

  it("avoids codes already in use", () => {
    const taken = ["000000", "000001", "000002"];
    let sequence = 0;
    const rng = () => [0, 0.00001, 0.00002, 0.5][sequence++];
    const code = generateUniqueCode(taken, rng);
    expect(taken).not.toContain(code);
  });

  it("falls back deterministically when the generator keeps colliding", () => {
    const code = generateUniqueCode(["000000", "000001"], () => 0);
    expect(code).toBe("000002");
  });
});
