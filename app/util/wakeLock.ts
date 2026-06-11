let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<void> {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    } else {
      console.warn("Wake Lock API is not supported in this browser.");
    }
  } catch (err) {
    console.error(err);
  }
}

export function releaseWakeLock(): void {
  if (wakeLock !== null) {
    void wakeLock.release();
    wakeLock = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (wakeLock !== null && document.visibilityState === "visible") {
    void requestWakeLock();
  }
});
