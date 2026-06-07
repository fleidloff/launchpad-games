import { initMidi } from "./midi";
import { AppManager } from "./appManager";
import { basicButtonsApp } from "./apps/BasicButtons/basicButtons";
import { fourInARowApp } from "./apps/FourInARow/fourInARow";
import { tactileSnakeApp } from "./apps/TactileSnake/tactileSnake";
import { logicMinesweeperApp } from "./apps/LogicMinesweeper/logicMinesweeper";

const manager = new AppManager();

// Register apps to the right column control buttons
manager.registerApp(89, basicButtonsApp);
manager.registerApp(79, fourInARowApp);
manager.registerApp(69, tactileSnakeApp);
manager.registerApp(59, logicMinesweeperApp);

async function startApp() {
  await initMidi(() => {
    manager.init();
  });
}

startApp();
export { manager };
