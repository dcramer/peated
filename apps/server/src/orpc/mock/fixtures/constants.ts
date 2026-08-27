export const timestamp = "2026-08-26T12:00:00.000Z";

const mockApiServer = process.env.API_SERVER ?? "http://localhost:4999";

export const mockImageUrls = {
  cairdeasWarehouse1: `${mockApiServer}/_assets/cairdeas-warehouse-1.webp`,
  cairdeasWhitePortMadeira: `${mockApiServer}/_assets/cairdeas-white-port-madeira.webp`,
  profile: `${mockApiServer}/_assets/profile.jpg`,
} as const;
