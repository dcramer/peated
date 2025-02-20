import { OpenAIEntityDetailsSchema, getGeneratedEntityDetails } from "../generateEntityDetails";
import { getMockFunction } from "@peated/server/test/utils";
import { getStructuredResponse } from "@peated/server/lib/openai";

jest.mock("@peated/server/lib/openai");

const mockGetStructuredResponse = getMockFunction(getStructuredResponse);

describe("OpenAIEntityDetailsSchema", () => {
  it("converts string yearEstablished to number", () => {
    const input = {
      yearEstablished: "1824",
      description: "Test description",
      website: "https://example.com",
      type: ["brand"]
    };
    
    const result = OpenAIEntityDetailsSchema.parse(input);
    
    expect(result.yearEstablished).toBe(1824);
    expect(typeof result.yearEstablished).toBe("number");
  });

  it("handles null yearEstablished", () => {
    const input = {
      yearEstablished: null,
      description: "Test description"
    };
    
    const result = OpenAIEntityDetailsSchema.parse(input);
    
    expect(result.yearEstablished).toBeNull();
  });

  it("handles undefined yearEstablished", () => {
    const input = {
      description: "Test description"
    };
    
    const result = OpenAIEntityDetailsSchema.parse(input);
    
    expect(result.yearEstablished).toBeUndefined();
  });
});

describe("getGeneratedEntityDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("processes OpenAI response with string yearEstablished", async () => {
    const mockEntity = {
      id: 1,
      name: "Test Distillery",
      country: { name: "Scotland" },
      region: { name: "Speyside" }
    };

    const mockOpenAIResponse = {
      description: "Test description",
      yearEstablished: "1824",
      website: "https://example.com",
      type: ["distiller"]
    };

    mockGetStructuredResponse.mockResolvedValueOnce(mockOpenAIResponse);

    const result = await getGeneratedEntityDetails(mockEntity);

    expect(result).toEqual({
      description: "Test description",
      yearEstablished: 1824,
      website: "https://example.com",
      type: ["distiller"]
    });
    expect(typeof result.yearEstablished).toBe("number");
  });
});