import { initMidi } from "./core/midi";
import { AppManager } from "./core/appManager";
import { fourInARowApp } from "./apps/FourInARow/fourInARow";
import { tactileSnakeApp } from "./apps/TactileSnake/tactileSnake";
import { logicMinesweeperApp } from "./apps/LogicMinesweeper/logicMinesweeper";
import { fingerTwister } from "./apps/Twister/twister";
import { reflexStorm } from "./apps/ReflexStorm/reflexStorm";
import { meowdoku } from "./apps/Meowdoku/meowdoku";
import { requestWakeLock } from "./util/wakeLock";

void requestWakeLock();

const manager = new AppManager();

manager.registerApp(29, meowdoku);
manager.registerApp(39, reflexStorm);
manager.registerApp(49, fingerTwister);
manager.registerApp(79, fourInARowApp);
manager.registerApp(69, tactileSnakeApp);
manager.registerApp(59, logicMinesweeperApp);

async function startApp(): Promise<void> {
  await initMidi(() => {
    manager.init();
  });
}

void startApp();
export { manager };
