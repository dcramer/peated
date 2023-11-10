import { Dialog } from "@headlessui/react";
import {
  ArrowPathRoundedSquareIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { useRef, useState } from "react";
import AvatarEditor from "react-avatar-editor";
import { useWindowSize } from "usehooks-ts";
import Button from "./button";
import Footer from "./footer";
import FormHeader from "./formHeader";
import Header from "./header";
import Layout from "./layout";

export default function ImageEditorModal({
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
}) {
  const ref = useRef<AvatarEditor>(null);
  const windowSize = useWindowSize();
  const [rotate, setRotate] = useState(0);
  const [scale, setScale] = useState(1);

  return (
    <Dialog open={open} as="div" className="dialog" onClose={setOpen}>
      <Dialog.Overlay className="fixed inset-0" />
      <Dialog.Panel className="dialog-panel">
        <Layout
          header={
            <Header>
              <FormHeader
                icon={<XMarkIcon className="h-full w-full" />}
                title="Crop Image"
                onClose={() => setOpen(false)}
                onSave={() => {
                  if (ref.current) {
                    onSave(ref.current.getImage());
                    setOpen(false);
                  }
                }}
              />
            </Header>
          }
          footer={
            <Footer>
              <div className="flex h-32 w-full flex-col items-center gap-x-2 gap-y-2 p-3">
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={scale}
                  className="range range-sm mb-6 block h-1 w-full cursor-pointer"
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
                </div>
              </div>
            </Footer>
          }
        >
          <div className=" flex flex-auto items-center justify-center">
            <AvatarEditor
              ref={ref}
              image={image}
              border={20}
              scale={scale}
              width={Math.min(600, windowSize.width) - 40}
              height={Math.min(600, windowSize.width) - 40}
              rotate={rotate}
            />
          </div>
        </Layout>
      </Dialog.Panel>
    </Dialog>
  );
}
