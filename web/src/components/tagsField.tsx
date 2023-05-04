import { Fragment, ReactNode, useState } from "react";

import FormField from "./formField";
import Rating from "./rating";
import classNames from "../lib/classNames";
import { Dialog, Transition } from "@headlessui/react";
import {
  ChevronDoubleRightIcon,
  PlusCircleIcon,
} from "@heroicons/react/20/solid";

// https://whiskeytrends.com/whiskey-tasting-terminology/
// https://www.bonigala.com/25-ways-to-describe-whisky
const basicDescriptions = [
  "bland",
  "course",
  "clean",
  "dry",
  "flat",
  "fresh",
  "green",
  "hard",
  "harsh",
  "heavy",
  "light",
  "mellow",
  "neutral",
  "rich",
  "round",
  "robust",
  "sharp",
  "soft",
  "sweet",
  "thin",
];
const aromaDescriptions = [
  "fruity",
  "dried fruit",
  "fresh fruit",
  "citrus",
  "melon",
  "lemon",
  "lime",
  "orange",
  "peach",
  "plum",
  "cherry",
  "berry",
  "apple",
  "green apple",
  "pear",
  "cranberry",
  "tart",
  "cherry",
  "currant",
  "sweet",
  "cake",
  "fruit cake",
  "candied cherries",
  "craisins",
  "figs",
  "raisins",
  "prunes",
  "dates",
  "dried apricots",
  "bananas",
  "flowery",
  "rosewater",
  "rose petals",
  "fragrant",
  "perfume",
  "meadow",
  "violets",
  "herbal",
  "savory",
  "esters",
  "vegetal",
  "grassy",
  "leafy",
  "clover",
  "laurel",
  "eucalyptus",
  "peat",
  "earth",
  "heath",
  "heather",
  "moor",
  "fen",
  "cedar",
  "silage",
  "hay",
  "cut grass",
  "musty",
  "moss",
  "wet dog",
  "butter",
  "oily",
  "fatty",
  "greasy",
  "butter",
  "oily",
  "fatty",
  "greasy",
  "chocolate",
  "cocoa",
  "malted milk",
  "smoke",
  "charred",
  "charcoal",
  "burnt",
  "fireplace",
  "campfire",
  "woody",
  "oak",
  "cask",
  "tannic",
  "rope",
  "spicy",
  "warmth",
  "hot",
  "zesty",
  "fiery",
  "spiced",
  "cinnamon",
  "nutmeg",
  "cloves",
  "vanilla",
  "anise",
  "tea",
  "coffee",
  "pine",
  "resin",
  "sap",
  "sherry",
  "oloroso",
  "wine",
  "red wine",
  "rum",
  "port",
  "liqueur",
  "malty",
  "grain",
  "cereal",
  "toast",
  "bread",
  "shortbread",
  "cookies",
  "biscuits",
  "oatmeal",
  "nutty",
  "almond",
  "walnuts",
  "coconut",
  "candy",
  "toffee",
  "butterscotch",
  "caramel",
  "marshmallow",
  "seaside",
  "seaweed",
  "salt",
  "kelp",
  "kippers",
  "brine",
  "ocean",
  "tobacco",
  "pipe tobacco",
  "cigar box",
  "leather",
  "honey",
  "syrup",
  "maple",
  "molasses",
  "alcohol burn",
  "ethanol",
  "spirity",
  "medicinal",
  "iodine",
  "solvent",
  "turpentine",
  "sulphuric",
  "creosote",
  "tar",
  "phenolic",
  "tarry rope",
  "bitter",
  "astringent",
  "dry",
  "tart",
  "acidic",
  "balanced",
  "nuanced",
  "complex",
  "clean",
  "subtle",
  "heavy",
  "smooth",
  "creamy",
  "full-bodied",
  "rich",
  "lasting",
  "long",
  "short",
];

type Props = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: string[];
  onChange?: (value: string[]) => void;
};

const Chip = ({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) => {
  return (
    <div
      className={classNames(
        "[word-wrap: break-word] inline-flex my-[5px] h-[32px] cursor-pointer items-center justify-between rounded-[16px] px-[12px] py-0 text-[13px] font-normal normal-case leading-loose shadow-none transition-[opacity] duration-300 ease-linear hover:!shadow-none border-gray-200 border text-peated",
        active && "bg-peated border-peated text-white"
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

const TagsDialog = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
}) => {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-10 overflow-y-auto min-h-screen"
        onClose={setOpen}
      >
        <div className="min-h-screen text-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0" />
          </Transition.Child>

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <Dialog.Panel className="relative h-screen transform overflow-hidden bg-white px-4 pb-4 pt-5 text-left transition-all min-w-full sm:p-6 justify-center items-center flex"></Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default ({
  name,
  helpText,
  label,
  required,
  className,
  ...props
}: Props) => {
  // pull the most used tags for this 1) bottle, 2) brand, 3) region, 4) country
  const suggestedTags = aromaDescriptions;
  const [value, setValue] = useState<string[]>(props.value || []);
  const [dialogOpen, setDialogOpen] = useState(false);

  const targetTags = 5;

  const removeTag = (name: string) => {
    setValue(value.filter((v) => v !== name));
  };

  const addTag = (name: string) => {
    if (value.indexOf(name) === -1) setValue([...value, name]);
  };

  return (
    <FormField
      label={label}
      htmlFor={`f-${name}`}
      required={required}
      helpText={helpText}
      className={className}
      labelAction={() => {
        setDialogOpen(true);
      }}
    >
      <div className="flex items-center gap-x-2">
        {value.map((v) => (
          <Chip key={v} active onClick={() => removeTag(v)}>
            {v}
          </Chip>
        ))}
        {value.length < targetTags &&
          suggestedTags
            .filter((v) => value.indexOf(v) === -1)
            .slice(0, targetTags - value.length)
            .map((v) => (
              <Chip key={v} onClick={() => addTag(v)}>
                {v}
              </Chip>
            ))}
      </div>
      <TagsDialog open={dialogOpen} setOpen={setDialogOpen} />
    </FormField>
  );
};
