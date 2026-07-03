import { redirect } from "next/navigation";

export default function AddTasting() {
  redirect("/addBottle?intent=tasting");
}
