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

  it("removes tokens, API keys, PINs and authorization headers", () => {
    const result = sanitizeError(
      "access_token=abc123 api_key: top-secret pin=9876 Authorization: Bearer ey.secret.value",
    );
    expect(result).not.toContain("abc123");
    expect(result).not.toContain("top-secret");
    expect(result).not.toContain("9876");
    expect(result).not.toContain("ey.secret.value");
  });

  it("removes URL userinfo and extended sensitive query parameters", () => {
    const result = sanitizeUrl(
      "https://alice:secret@iptv.example/api?access_token=abc&api_key=def&sessionid=ghi",
    );
    expect(result).not.toContain("alice");
    expect(result).not.toContain("secret");
    expect(result).not.toContain("abc");
    expect(result).not.toContain("def");
    expect(result).not.toContain("ghi");
  });
});
