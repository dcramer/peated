import { createRef, useCallback, useLayoutEffect } from "react";
import Quagga from "@ericblade/quagga2";
import { captureException } from "@sentry/react";
import { Dialog } from "@headlessui/react";

function getMedian(arr: number[]) {
  arr.sort((a, b) => a - b);
  const half = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) {
    return arr[half];
  }
  return (arr[half - 1] + arr[half]) / 2;
}

function getMedianOfCodeErrors(decodedCodes: any[]) {
  const errors = decodedCodes
    .filter((x: any) => x.error !== undefined)
    .map((x: any) => x.error);
  const medianOfErrors = getMedian(errors);
  return medianOfErrors;
}

const defaultConstraints = {
  width: 640,
  height: 480,
};

const defaultLocatorSettings = {
  patchSize: "medium",
  halfSample: true,
};

const defaultDecoders = ["ean_reader"];

export type Props = {
  open: boolean;
  setOpen: (value: boolean) => void;
  onDetected: (result: string | null) => void;
  onScannerReady?: () => void;
  cameraId?: string;
  facingMode?: string;
  constraints?: {
    width?: number | { min: number };
    height?: number | { min: number };
    aspectRatio?: any;
  };
  locator?: {
    patchSize: string;
    halfSample: boolean;
  };
  numOfWorkers?: number;
  decoders?: any; // give up on ts
  locate?: boolean;
};

export default ({
  open,
  setOpen,
  onDetected,
  onScannerReady,
  cameraId,
  facingMode = "environment",
  constraints = defaultConstraints,
  locator = defaultLocatorSettings,
  numOfWorkers = navigator.hardwareConcurrency || 0,
  decoders = defaultDecoders,
  locate = true,
}: Props) => {
  const scannerRef = createRef<HTMLDivElement>();

  const errorCheck = useCallback(
    (result: any) => {
      if (!onDetected) {
        return;
      }
      const err = getMedianOfCodeErrors(result.codeResult.decodedCodes);
      // if Quagga is at least 75% certain that it read correctly, then accept the code.
      if (err < 0.25) {
        onDetected(result.codeResult.code);
      }
    },
    [onDetected]
  );

  const handleProcessed = (result: any) => {
    const drawingCtx = Quagga.canvas.ctx.overlay;
    const drawingCanvas = Quagga.canvas.dom.overlay;
    drawingCtx.font = "24px Arial";
    drawingCtx.fillStyle = "green";

    if (result) {
      // console.warn('* quagga onProcessed', result);

      if (result.boxes) {
        drawingCtx.clearRect(
          0,
          0,
          parseInt(drawingCanvas.getAttribute("width") || "0"),
          parseInt(drawingCanvas.getAttribute("height") || "0")
        );
        result.boxes
          .filter((box: any) => box !== result.box)
          .forEach((box: any) => {
            Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, {
              color: "purple",
              lineWidth: 2,
            });
          });
      }
      if (result.box) {
        Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
          color: "blue",
          lineWidth: 2,
        });
      }
      if (result.codeResult && result.codeResult.code) {
        // const validated = barcodeValidator(result.codeResult.code);
        // const validated = validateBarcode(result.codeResult.code);
        // Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: validated ? 'green' : 'red', lineWidth: 3 });
        drawingCtx.font = "24px Arial";
        // drawingCtx.fillStyle = validated ? 'green' : 'red';
        // drawingCtx.fillText(`${result.codeResult.code} valid: ${validated}`, 10, 50);
        drawingCtx.fillText(result.codeResult.code, 10, 20);
        // if (validated) {
        //     onDetected(result);
        // }
      }
    }
  };

  useLayoutEffect(() => {
    if (!scannerRef || !scannerRef.current) return;
    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          constraints: {
            ...constraints,
            ...(cameraId && { deviceId: cameraId }),
            ...(!cameraId && { facingMode }),
          },
          target: scannerRef.current,
        },
        locator,
        numOfWorkers,
        decoder: { readers: decoders },
        locate,
      },
      (err) => {
        Quagga.onProcessed(handleProcessed);

        if (err) {
          captureException(err);
          return console.log("Error starting Quagga:", err);
        }
        if (scannerRef && scannerRef.current) {
          Quagga.start();
          if (onScannerReady) {
            onScannerReady();
          }
        }
      }
    );
    Quagga.onDetected(errorCheck);
    return () => {
      Quagga.offDetected(errorCheck);
      Quagga.offProcessed(handleProcessed);
      Quagga.stop();
    };
  }, [
    cameraId,
    onDetected,
    onScannerReady,
    scannerRef,
    errorCheck,
    constraints,
    locator,
    decoders,
    locate,
  ]);

  return (
    <Dialog
      as="div"
      className="fixed inset-0 z-10 overflow-y-auto min-h-screen"
      unmount={true}
      open={open}
      onClose={setOpen}
    >
      <Dialog.Overlay className="fixed inset-0" />
      <Dialog.Panel className="relative h-screen transform overflow-hidden bg-white px-4 pb-4 pt-5 text-left transition-all min-w-full sm:p-6 justify-center items-center flex">
        <div className="relative" ref={scannerRef}>
          <canvas
            className="drawingBuffer"
            style={{
              position: "absolute",
              top: "0px",
              // left: '0px',
              // height: '100%',
              // width: '100%',
              border: "3px solid green",
            }}
            width="640"
            height="480"
          />
        </div>
      </Dialog.Panel>
    </Dialog>
  );
};
