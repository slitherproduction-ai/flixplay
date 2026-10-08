import { sanitizeError, sanitizeUrl } from "@/services/security/sanitize";

describe("security sanitization edge cases", () => {
  it("removes URL user-info credentials and keeps only the non-sensitive host/path", () => {
    const result = sanitizeUrl(
      "https://alice:very-secret@iptv.example:8443/status",
    );

    expect(result).toContain("iptv.example:8443/status");
    expect(result).not.toContain("alice");
    expect(result).not.toContain("very-secret");
  });

  it.each([
    "user",
    "passwd",
    "pwd",
    "authorization",
    "access_token",
    "refresh-token",
    "api_key",
    "secret",
    "pin",
    "sessionid",
  ])("redacts the %s query parameter case-insensitively", (key) => {
    const result = sanitizeUrl(
      `https://iptv.example/api?${key}=sensitive-value&action=list`,
    );

    expect(result).not.toContain("sensitive-value");
    expect(result).toContain(`${key}=***`);
    expect(result).toContain("action=list");
  });

  it("redacts credentials from movie and series stream paths", () => {
    const movie = sanitizeUrl(
      "https://iptv.example/movie/customer/movie-pass/77.mp4",
    );
    const series = sanitizeUrl(
      "https://iptv.example/series/customer/series-pass/88.mkv",
    );

    for (const result of [movie, series]) {
      expect(result).not.toContain("customer");
      expect(result).not.toContain("-pass");
      expect(result).toContain("/***/***/");
    }
  });

  it("redacts standalone assignments and authorization schemes", () => {
    const result = sanitizeError(
      "token=top-secret password: hunter2 Bearer eyJhbGciOiJIUzI1NiJ9.signature Basic dXNlcjpwYXNz",
    );

    expect(result).not.toContain("top-secret");
    expect(result).not.toContain("hunter2");
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9.signature");
    expect(result).not.toContain("dXNlcjpwYXNz");
    expect(result).toContain("token=***");
    expect(result).toContain("password: ***");
    expect(result).toContain("Bearer ***");
    expect(result).toContain("Basic ***");
  });

  it("returns a neutral marker for malformed URLs instead of echoing input", () => {
    const sensitiveGarbage = "not a url alice:secret@private-host";

    expect(sanitizeUrl(sensitiveGarbage)).toBe("[URL removida]");
    expect(sanitizeUrl(sensitiveGarbage)).not.toContain("secret");
  });
});
