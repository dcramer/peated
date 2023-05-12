import axios from "axios";

const API_SERVER = process.env.API_SERVER || "http://localhost:4000";

export async function submitBottle(data: any) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
  };

  try {
    await axios.post(`${API_SERVER}/bottles`, data, {
      headers,
    });
  } catch (err: any) {
    const data = err?.response?.data;
    console.error(
      `Failed to submit bottle: ${err?.response.status} - ${JSON.stringify(
        data,
        null,
        2,
      )}`,
    );
  }
}

export async function submitEntity(data: any) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
  };

  try {
    await axios.post(`${API_SERVER}/entities`, data, {
      headers,
    });
  } catch (err: any) {
    const data = err?.response?.data;
    console.error(
      `Failed to submit entity: ${err?.response.status} -${JSON.stringify(
        data,
        null,
        2,
      )}`,
    );
  }
}
