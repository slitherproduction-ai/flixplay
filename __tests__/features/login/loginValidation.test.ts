import {
  normalizeServerUrl,
  validateCodeLoginFields,
  validateLoginFields,
} from "@/features/login/loginValidation";

describe("login validation", () => {
  it("preserves the supplied HTTP protocol and port while removing pasted paths", () => {
    expect(normalizeServerUrl(" http://flixplay.sbs:8080/player_api.php?x=1 "))
      .toBe("http://flixplay.sbs:8080");
  });

  it("uses HTTP as the compatibility default only when a protocol is absent", () => {
    expect(normalizeServerUrl("iptv.example.com:8080")).toBe("http://iptv.example.com:8080");
    expect(validateLoginFields("", "user", "pass")).toContain("Host");
    expect(validateCodeLoginFields("  ", "user", "pass")).toContain("código");
  });
});
