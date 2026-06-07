import { initMidi } from "./midi";
import * as fourInARow from "./apps/fourInARow";

async function startApp() {
  await initMidi(() => {
    // Current active app
    fourInARow.init();
  });
}

startApp();
