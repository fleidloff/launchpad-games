// Universal variable to store the wake lock object
let wakeLock = null;

// Function to request the wake lock
export async function requestWakeLock() {
  try {
    // 1. Check if the feature is supported in Chrome
    if ("wakeLock" in navigator) {
      // 2. Request the screen wake lock
      wakeLock = await navigator.wakeLock.request("screen");
      console.log("Screen Wake Lock is active!");

      // 3. Listen for the lock being released (e.g., if user minimizes the tab)
      wakeLock.addEventListener("release", () => {
        console.log("Screen Wake Lock was released.");
      });
    } else {
      console.warn("Wake Lock API is not supported in this browser.");
    }
  } catch (err) {
    // Handle errors (e.g., battery saver mode blocking it)
    console.error(`${err.name}, ${err.message}`);
  }
}

// Function to manually release the lock when done
export function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release();
    wakeLock = null;
  }
}

document.addEventListener("visibilitychange", async () => {
  console.log("request wakelock");
  if (wakeLock !== null && document.visibilityState === "visible") {
    await requestWakeLock();
  }
});
