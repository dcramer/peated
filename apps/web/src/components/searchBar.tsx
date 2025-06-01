import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { useSearchParams } from "next/navigation";
import Form from "./form";
import TextInput from "./textInput";

export default function SearchBar({ name = "query" }: { name?: string }) {
  const searchParams = useSearchParams();

  return (
    <Form className="">
      <div className="my-2 flex items-center gap-x-2 px-3 py-2">
        <MagnifyingGlassIcon className="h-5 w-5 text-muted " />
        <div className="flex-grow">
          <TextInput
            type="text"
            name={name}
            defaultValue={searchParams.get(name) ?? ""}
          />
        </div>
      </div>
    </Form>
  );
}
