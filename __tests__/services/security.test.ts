import { sanitizeError, sanitizeUrl } from "@/services/security/sanitize";

describe("security sanitization", () => {
  it("removes credentials from Xtream query URLs", () => {
    const result = sanitizeUrl(
      "http://iptv.example:8080/player_api.php?username=alice&password=secret&action=get_live_streams",
    );
    expect(result).not.toContain("alice");
    expect(result).not.toContain("secret");
    expect(result).toContain("username=***");
    expect(result).toContain("password=***");
  });

  it("removes credentials embedded in stream paths", () => {
    const result = sanitizeUrl("https://iptv.example/live/alice/secret/123.ts");
    expect(result).not.toContain("alice");
    expect(result).not.toContain("secret");
    expect(result).toContain("/live/***/***/123.ts");
  });

  it("sanitizes URLs contained in error messages", () => {
    const result = sanitizeError(
      new Error("Falha em http://iptv.example/player_api.php?username=alice&password=secret"),
    );
    expect(result).not.toContain("alice");
    expect(result).not.toContain("secret");
  });
});
