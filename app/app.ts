import { initMidi } from "./midi";
import * as fourInARow from "./apps/FourInARow/fourInARow";
// import * as basicButtons from "./apps/BasicButtons/basicButtons";

async function startApp() {
  await initMidi(() => {
    // Current active app
    fourInARow.init();
  });
}

startApp();
