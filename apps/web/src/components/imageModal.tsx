import { Dialog } from "@headlessui/react";
import { ArrowPathRoundedSquareIcon } from "@heroicons/react/20/solid";
import { useRef, useState } from "react";
import AvatarEditor from "react-avatar-editor";
import Button from "./button";

export default ({
  image,
  open,
  setOpen,
  onSave,
  width = 250,
  height = 250,
}: {
  image: any;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSave: (newImage: any) => void;
  width?: number;
  height?: number;
}) => {
  const ref = useRef<AvatarEditor>(null);
  const [rotate, setRotate] = useState(0);
  const [scale, setScale] = useState(1);

  return (
    <Dialog open={open} as="div" className="dialog" onClose={setOpen}>
      <Dialog.Overlay className="fixed inset-0" />
      <Dialog.Panel className="dialog-panel flex flex-col items-center justify-center px-4 pb-4 pt-5 sm:p-6">
        <AvatarEditor
          ref={ref}
          image={image}
          width={width}
          height={height}
          border={50}
          scale={scale}
          rotate={rotate}
        />
        <div className="flex flex-col gap-x-2 gap-y-2">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={scale}
            onInput={(e) => {
              setScale(parseFloat((e as any).target.value));
            }}
          />
          <div className="flex gap-x-2">
            <Button
              onClick={() => {
                const newRotate = rotate >= 270 ? 0 : rotate + 90;
                setRotate(newRotate);
              }}
              icon={<ArrowPathRoundedSquareIcon className="h-6 w-6" />}
            ></Button>
            <Button
              color="highlight"
              onClick={() => {
                if (ref.current) {
                  onSave(ref.current.getImageScaledToCanvas());
                  setOpen(false);
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
};
