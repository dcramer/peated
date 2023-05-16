import axios from "axios";
import { open } from "fs/promises";

async function main(num: number) {
  for (let i = 0; i < num; i++) {
    const resp = await axios.post(
      `https://api.deepai.org/api/logo-generator `,
      {
        data: {
          text: "whiskey cask",
        },
      },
      {
        headers: {
          "api-key": `${process.env.API_KEY}`,
        },
      },
    );

    const { id, output_url } = await resp.data;

    const image = await axios.get(output_url, {
      responseType: "blob",
    });

    const fs = await open(`${id}.jpg`, "w");
    await fs.writeFile(image.data);
    await fs.close();
  }
}

main(100);
