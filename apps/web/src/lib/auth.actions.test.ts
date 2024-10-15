import waitError from "@peated/server/lib/test/waitError";
import { makeTRPCClient } from "@peated/server/trpc/client";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "./auth.actions";
import { getSession } from "./session.server";

// Mock dependencies
vi.mock("@peated/server/trpc/client");
vi.mock("./session.server");
vi.mock("next/navigation");

// Helper function to create FormData
function createFormData(data: Record<string, string>) {
  return {
    get: vi.fn((key: string) => data[key] || null),
  } as unknown as FormData;
}

describe("authenticate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should authenticate successfully with email and password", async () => {
    const mockUser = { id: "1", email: "test@example.com", verified: true };
    const mockSession = { save: vi.fn() };
    const mockTrpcClient = {
      authBasic: {
        mutate: vi
          .fn()
          .mockResolvedValue({ user: mockUser, accessToken: "token123" }),
      },
    };

    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(makeTRPCClient).mockReturnValue(mockTrpcClient as any);

    const formData = createFormData({
      email: "test@example.com",
      password: "password123",
    });

    await authenticate(formData);

    expect(mockTrpcClient.authBasic.mutate).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(mockSession.save).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("should authenticate successfully with Google code", async () => {
    const mockUser = { id: "1", email: "test@example.com", verified: true };
    const mockSession = { save: vi.fn() };
    const mockTrpcClient = {
      authGoogle: {
        mutate: vi
          .fn()
          .mockResolvedValue({ user: mockUser, accessToken: "token123" }),
      },
    };

    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(makeTRPCClient).mockReturnValue(mockTrpcClient as any);

    const formData = createFormData({ code: "google_auth_code" });

    await authenticate(formData);

    expect(mockTrpcClient.authGoogle.mutate).toHaveBeenCalledWith({
      code: "google_auth_code",
    });
    expect(mockSession.save).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("should return an error for invalid credentials", async () => {
    const mockTrpcClient = {
      authBasic: {
        mutate: vi.fn().mockRejectedValue({ data: { code: "UNAUTHORIZED" } }),
      },
    };

    vi.mocked(makeTRPCClient).mockReturnValue(mockTrpcClient as any);

    const formData = createFormData({
      email: "test@example.com",
      password: "wrongpassword",
    });

    const result = await authenticate(formData);

    expect(result).toEqual({
      magicLink: false,
      error: "Invalid credentials",
    });
  });

  it("should generate a magic link when email is provided without password", async () => {
    const mockTrpcClient = {
      authMagicLinkSend: { mutate: vi.fn().mockResolvedValue({}) },
    };

    vi.mocked(makeTRPCClient).mockReturnValue(mockTrpcClient as any);

    const formData = createFormData({ email: "test@example.com" });

    const result = await authenticate(formData);

    expect(mockTrpcClient.authMagicLinkSend.mutate).toHaveBeenCalledWith({
      email: "test@example.com",
    });
    expect(result).toEqual({
      magicLink: true,
      error: null,
    });
  });

  it("should redirect to /verify for unverified users", async () => {
    const mockUser = { id: "1", email: "test@example.com", verified: false };
    const mockSession = { save: vi.fn() };
    const mockTrpcClient = {
      authBasic: {
        mutate: vi
          .fn()
          .mockResolvedValue({ user: mockUser, accessToken: "token123" }),
      },
    };

    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(makeTRPCClient).mockReturnValue(mockTrpcClient as any);

    const formData = createFormData({
      email: "test@example.com",
      password: "password123",
    });

    await authenticate(formData);

    expect(redirect).toHaveBeenCalledWith("/verify");
  });

  it("should throw an error for unexpected errors", async () => {
    const mockTrpcClient = {
      authBasic: {
        mutate: vi.fn().mockRejectedValue(new Error("Unexpected error")),
      },
    };

    vi.mocked(makeTRPCClient).mockReturnValue(mockTrpcClient as any);

    const formData = createFormData({
      email: "test@example.com",
      password: "password123",
    });

    const err = await waitError(authenticate(formData));

    expect(err).toMatchInlineSnapshot("[Error: Unexpected error]");
  });
});
