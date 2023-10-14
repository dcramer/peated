import axios from "axios";
import config from "~/config";

export async function submitBottle(data: any) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
  };

  try {
    await axios.post(`${config.API_SERVER}/bottles`, data, {
      headers,
    });
  } catch (err: any) {
    const data = err?.response?.data;
    if (!data) {
      console.error(err);
    } else {
      console.error(
        `Failed to submit bottle: ${err?.response.status} - ${JSON.stringify(
          data,
          null,
          2,
        )}`,
      );
    }
  }
}

export async function submitEntity(data: any) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
  };

  try {
    await axios.post(`${config.API_SERVER}/entities`, data, {
      headers,
    });
  } catch (err: any) {
    const data = err?.response?.data;
    if (!data) {
      console.error(err.toString());
    } else {
      console.error(
        `Failed to submit entity: ${err?.response.status} -${JSON.stringify(
          data,
          null,
          2,
        )}`,
      );
    }
  }
}

export type StorePrice = {
  name: string;
  price: number;
  priceUnit: string;
  url: string;
  volume: number;
};

export async function submitStorePrices(storeId: number, data: StorePrice[]) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
  };

  try {
    await axios.post(`${config.API_SERVER}/stores/${storeId}/prices`, data, {
      headers,
    });
  } catch (err: any) {
    const data = err?.response?.data;
    if (!data) {
      console.error(err.toString());
    } else {
      console.error(
        `Failed to submit prices: ${err?.response.status} -${JSON.stringify(
          data,
          null,
          2,
        )}`,
      );
    }
  }
}
