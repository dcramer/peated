import { describe, expect, it, vi } from "vitest";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { getGeneratedEntityDetails } from "../generateEntityDetails";

// Mock OpenAI response handling
vi.mock("@peated/server/lib/openai", () => ({
  getStructuredResponse: vi.fn(),
}));

describe("getGeneratedEntityDetails", () => {
  it("should handle string yearEstablished from OpenAI and convert to number", async () => {
    const mockEntity = {
      id: 1,
      name: "Test Distillery",
      country: { name: "Scotland" },
      region: { name: "Speyside" },
    };

    const mockOpenAIResponse = {
      description: "Test description",
      yearEstablished: "1824",
      website: "https://example.com",
      type: ["distiller", "brand"],
    };

    // Mock the OpenAI response
    (getStructuredResponse as jest.Mock).mockResolvedValue(mockOpenAIResponse);

    const result = await getGeneratedEntityDetails(mockEntity);

    expect(result).toBeDefined();
    expect(result?.yearEstablished).toBe(1824);
    expect(typeof result?.yearEstablished).toBe("number");
  });

  it("should handle null yearEstablished properly", async () => {
    const mockEntity = {
      id: 1,
      name: "Test Distillery",
    };

    const mockOpenAIResponse = {
      description: "Test description",
      yearEstablished: null,
      type: ["brand"],
    };

    (getStructuredResponse as jest.Mock).mockResolvedValue(mockOpenAIResponse);

    const result = await getGeneratedEntityDetails(mockEntity);

    expect(result).toBeDefined();
    expect(result?.yearEstablished).toBeNull();
  });
});