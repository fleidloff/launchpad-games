import { initMidi } from "./midi";
import * as basicButtons from "./apps/basicButtons";

async function startApp() {
  await initMidi(() => {
    // This is where you can swap between different modular apps
    basicButtons.init();
  });
}

startApp();
