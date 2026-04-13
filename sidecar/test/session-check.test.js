import { describe, it, expect } from "vitest";
import { assertSessionAlive } from "../src/tesco/session-check.js";

describe("assertSessionAlive", () => {
  it("does not throw when URL is a normal Tesco page", () => {
    const page = { url: () => "https://www.tesco.com/groceries/en-GB/search?query=milk" };
    expect(() => assertSessionAlive(page)).not.toThrow();
  });

  it("throws session_expired when redirected to /account/login", () => {
    const page = { url: () => "https://www.tesco.com/account/login?from=..." };
    expect(() => assertSessionAlive(page)).toThrow("session_expired");
  });

  it("throws session_expired when redirected to /account/auth", () => {
    const page = { url: () => "https://www.tesco.com/account/auth/en-GB/login?from=..." };
    expect(() => assertSessionAlive(page)).toThrow("session_expired");
  });

  it("does not throw for product pages", () => {
    const page = { url: () => "https://www.tesco.com/groceries/en-GB/products/123456" };
    expect(() => assertSessionAlive(page)).not.toThrow();
  });

  it("does not throw for the basket page", () => {
    const page = { url: () => "https://www.tesco.com/groceries/" };
    expect(() => assertSessionAlive(page)).not.toThrow();
  });
});
