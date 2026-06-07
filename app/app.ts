import { initMidi } from "./midi";
import * as fourInARow from "./apps/fourInARow";
// import * as basicButtons from "./apps/basicButtons";

async function startApp() {
  await initMidi(() => {
    // Current active app
    fourInARow.init();
  });
}

startApp();
