"use client";

/**
 * One-frame capture from the rear camera, used mid-call.
 *
 * The stream is opened, held for a beat so the user can actually point the
 * phone, grabbed, and torn down immediately — the camera light should not stay
 * on a second longer than it needs to. A denial returns null; the caller
 * carries on without it.
 */

const SETTLE_MS = 2000;
const MAX_EDGE = 640;
const JPEG_QUALITY = 0.7;

export async function captureFrame(settleMs = SETTLE_MS): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      audio: false,
    });
  } catch {
    return null; // denied, or no camera — not an error worth surfacing mid-call
  }

  // Safari won't decode frames from a fully detached element, so park it
  // off-screen rather than leaving it out of the document.
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:2px;height:2px;";
  document.body.appendChild(video);

  try {
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, settleMs));

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return null;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    video.remove();
  }
}
