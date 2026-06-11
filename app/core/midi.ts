import { WebMidi } from "webmidi";
import type { Input, Output } from "webmidi";

export let lpInput: Input | undefined = undefined;
export let lpOutput: Output | undefined = undefined;

let isInitialized = false;

export async function initMidi(onReady: () => void): Promise<void> {
  try {
    await WebMidi.enable({ sysex: true });
    
    WebMidi.addListener("connected", () => checkDevices(onReady));
    WebMidi.addListener("disconnected", () => checkDevices(onReady));
    
    checkDevices(onReady);
  } catch (err) {
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      statusDiv.innerText = "Web MIDI not supported/allowed.";
    }
    console.error(err);
  }
}

function setStatus(text: string, className: string): void {
  const statusDiv = document.getElementById("status");
  if (!statusDiv) return;
  statusDiv.innerText = text;
  statusDiv.className = className;
}

function checkDevices(onReady: () => void): void {
  lpInput = WebMidi.inputs.find((i) => i.name.includes("Launchpad X"));
  lpOutput = WebMidi.outputs.find((o) => o.name.includes("Launchpad X"));

  if (!lpInput || !lpOutput) {
    setStatus("Launchpad X Not Found", "disconnected");
    isInitialized = false;
    return;
  }

  setStatus("Launchpad X Connected!", "connected");

  if (!isInitialized) {
    setTimeout(() => {
      onReady();
      isInitialized = true;
    }, 100);
  }
}
