import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { useSearch } from "@tanstack/react-router";
import Form from "./form";
import TextInput from "./textInput";

export default function SearchBar({ name = "query" }: { name?: string }) {
  const searchParams = useSearch({ strict: false });

  return (
    <Form className="">
      <div className="my-2 flex items-center gap-x-2 px-3 py-2">
        <MagnifyingGlassIcon className="h-5 w-5 text-muted " />
        <div className="flex-grow">
          <TextInput
            type="text"
            name={name}
            defaultValue={(searchParams as any)[name] ?? ""}
          />
        </div>
      </div>
    </Form>
  );
}
