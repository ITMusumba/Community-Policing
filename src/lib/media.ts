import { Capacitor } from "@capacitor/core";

/** Shrinks a photo to at most 1280 px on its longest side as JPEG, so uploads stay small and under the server's 10 MB limit. */
export async function compressImage(file: Blob): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing unavailable.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not compress photo")), "image/jpeg", 0.7));
}

/** True inside the installed Android/iOS app (Capacitor), false in a normal browser. */
export const isNativeApp = () => Capacitor.isNativePlatform();

function base64ToFile(base64: string, format = "jpeg") {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new File([bytes], `photo-${Date.now()}.${format === "jpeg" ? "jpg" : format}`, { type: `image/${format}` });
}

/**
 * Opens the phone camera through Capacitor's Camera plugin. The browser <input capture> route is unreliable in the
 * app: the photo can come back empty, and the app may be closed by Android while the camera is open.
 * Returns null when the person cancels.
 */
export async function takeNativePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Base64, quality: 70, width: 1600, correctOrientation: true, saveToGallery: false });
    return photo.base64String ? base64ToFile(photo.base64String, photo.format) : null;
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return null;
    throw e;
  }
}

/**
 * If Android closed the app while the camera was open, the photo is delivered when the app restarts.
 * Calls `onPhoto` with it; returns a cleanup function.
 */
export function onRestoredPhoto(onPhoto: (file: File) => void): () => void {
  if (!isNativeApp()) return () => undefined;
  let remove: (() => void) | undefined;
  let cancelled = false;
  void import("@capacitor/app").then(({ App }) => App.addListener("appRestoredResult", event => {
    const data = event.data as { base64String?: string; format?: string } | undefined;
    if (event.pluginId === "Camera" && event.methodName === "getPhoto" && event.success && data?.base64String) onPhoto(base64ToFile(data.base64String, data.format));
  })).then(handle => { if (cancelled) void handle.remove(); else remove = () => void handle.remove(); });
  return () => { cancelled = true; remove?.(); };
}
