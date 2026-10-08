import { describe, expect, it } from "vitest";
import { profileLabel, userInitials, welcomeName } from "@/lib/userDisplay";

const person = { accountType: "individual", firstName: "Mohammad", lastName: "Khan", businessName: null, email: "m@example.com" };

describe("user display", () => {
  it("welcomes a person by first name and shows their initials", () => {
    expect(welcomeName(person)).toBe("Mohammad");
    expect(userInitials(person)).toBe("MK");
    expect(profileLabel(person)).toBe("Individual Profile");
  });
  it("uses the business name for a business", () => {
    const biz = { ...person, accountType: "business", firstName: null, lastName: null, businessName: "Acme Trading" };
    expect(welcomeName(biz)).toBe("Acme Trading");
    expect(userInitials(biz)).toBe("AT");
    expect(profileLabel(biz)).toBe("Business Profile");
  });
  it("falls back gracefully when names are missing", () => {
    const bare = { ...person, firstName: null, lastName: null };
    expect(welcomeName(bare)).toBe("m");
    expect(userInitials(bare)).toBe("M");
    expect(welcomeName(null)).toBe("");
    expect(userInitials(undefined)).toBe("");
  });
});
