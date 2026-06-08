import { initMidi } from "./core/midi";
import { AppManager } from "./core/appManager";
import { fourInARowApp } from "./apps/FourInARow/fourInARow";
import { tactileSnakeApp } from "./apps/TactileSnake/tactileSnake";
import { logicMinesweeperApp } from "./apps/LogicMinesweeper/logicMinesweeper";
import { fingerTwister } from "./apps/Twister/twister";
import { reflexStorm } from "./apps/ReflexStorm/reflexStorm";
import { requestWakeLock } from "./util/wakeLock";

import { matrixClock } from "./apps/MatrixClock/matrixClock";
import { weatherStation } from "./apps/Weather/weather";
import { fireplace } from "./apps/Fireplace/firePlace";
import { basicButtonsApp } from "./apps/BasicButtons/basicButtons";

requestWakeLock();

const manager = new AppManager();

// Register apps to the right column control buttons
manager.registerApp(39, reflexStorm);
manager.registerApp(49, fingerTwister);
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
