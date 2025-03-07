import path from 'path';
import browserstack from 'browserstack-local';
import webdriver, { Builder, logging } from 'selenium-webdriver';
import * as dotenv from 'dotenv';
import { ROOT_DIR } from './constants';
import { existsSync, readFileSync, writeFileSync } from 'fs-extra';

/****
 * Types
 */
export type Browserstack = browserstack.Local;

export interface BrowserOption {
  os?: string;
  os_version: string;
  browser?: string;
  browser_version?: string;
  device?: string;
  real_mobile?: 'true';
  browserName?: string;
  localhost?: string;
}

export type FilterBrowserOption = (option: BrowserOption) => boolean;

/****
 * Constants
 */

const env = getEnv();

const browserOptions: Array<BrowserOption> = JSON.parse(readFileSync(path.resolve(__dirname, './browserStackOptions.json'), 'utf8'));
const mobileBrowserOptions: Array<BrowserOption> = JSON.parse(readFileSync(path.resolve(__dirname, './browserStackMobileOptions.json'), 'utf8')).map((option: BrowserOption[]) => ({
  "real_mobile": "true",
  "localhost": "bs-local.com",
  ...option,
}));

const username = env.BROWSERSTACK_USERNAME;
const accessKey = env.BROWSERSTACK_ACCESS_KEY;

const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.INFO);

/****
 * Public Constants
 */
export const serverURL = `http://${username}:${accessKey}@hub-cloud.browserstack.com/wd/hub`;
export const DEFAULT_CAPABILITIES = {
  'build': env.BROWSERSTACK_BUILD_NAME,
  'project': env.BROWSERSTACK_PROJECT_NAME,
  'browserstack.local': true,
  // 'browserstack.localIdentifier': process.env.BROWSERSTACK_LOCAL_IDENTIFIER,
}

/****
 * Utility Functions
 */
function getEnv () {
  const localEnvPath = path.resolve(ROOT_DIR, '.env')
  if (existsSync(localEnvPath)) {
    return {
      ...process.env,
      ...dotenv.parse(readFileSync(localEnvPath, 'utf-8')),
    };
  }

  return process.env;
}

function shouldPrintLogs (entry: webdriver.logging.Entry, capabilities: BrowserOption) {
  if (entry.message.includes('favicon')) {
    return false;
  }

  // if running in IE, it appears TFJS is already available? Ignore warnings
  // about the TFJS backend already being registered
  if (entry.level.name === 'WARNING' && capabilities?.browserName === 'edge') {
    return false;
  }

  return true;
}


/****
 * Public Functions
 */
export const getBrowserstackAccessKey = () => getEnv().BROWSERSTACK_ACCESS_KEY;

export const startBrowserstack = async (key?: string, bs?: browserstack.Local): Promise<Browserstack> => new Promise((resolve, reject) => {
  if (!key) {
    throw new Error('A key must be passed to start up the local browserstack service');
  }
  if (!bs) {
    console.log('Start browserstack with a branch new object')
    bs = new browserstack.Local();
  } else {
    console.log('Start browserstack with an existing object')
  }
  bs.start({
    key,
    force: true,
    onlyAutomate: true,
    forceLocal: true,
  }, (error) => {
    if (error) {
      return reject(error);
    }
    if (!bs || bs.isRunning() !== true) {
      throw new Error('Browserstack failed to start');
    }
    console.log('Browserstack started');
    resolve(bs);
  });
});

export const stopBrowserstack = (bs: Browserstack): Promise<void> => new Promise(resolve => bs.stop(() => resolve()));

export const getBrowserOptions = (filter?: FilterBrowserOption): Array<BrowserOption> => browserOptions.filter(filter || Boolean);

export const getMobileBrowserOptions = (filter?: FilterBrowserOption): Array<BrowserOption> => mobileBrowserOptions.filter(filter || Boolean);

type Capabilities = Parameters<Builder['withCapabilities']>[0];
export const getDriver = (capabilities: Capabilities): webdriver.ThenableWebDriver => new webdriver.Builder()
  .usingServer(serverURL)
  .setLoggingPrefs(prefs)
  .withCapabilities({
    ...DEFAULT_CAPABILITIES,
    ...capabilities,
  })
  .build();

export const printLogs = async (driver: webdriver.WebDriver, capabilities: BrowserOption, verbose = false) => {
  if (capabilities?.browserName === 'firefox') {
    if (capabilities?.os === 'windows') {
      if (verbose) {
        console.log('Not printing logs, because it is Windows Firefox')
      }
      // There is a bug with Firefox not supporting the get logs method on Windows
      // https://stackoverflow.com/questions/59192232/selenium-trying-to-get-firefox-console-logs-results-in-webdrivererror-http-me
      // console.log('** Firefox on Windows does not support logging')
      return;
    }
    if (capabilities?.os === 'OS X') {
      if (verbose) {
        console.log('Not printing logs, because it is OS X Firefox')
      }
      // Firefox does not seem to support logging on OS X either
      // https://github.com/mozilla/geckodriver/issues/1698
      // console.log('** Firefox on OS X does not support logging')
      return;
    }
  }

  if (capabilities?.browserName === 'safari') {
    if (verbose) {
      console.log('Not printing logs, because it is Safari')
    }
    // It looks like Safari also does not support logging
    // console.log('** Safari does not support logging')
    return;
  }

  const logs = await driver.manage().logs().get(logging.Type.BROWSER);

  if (verbose) {
    console.log(`Got ${logs.length} logs`);
  }

  for (const entry of logs) {
    if (shouldPrintLogs(entry, capabilities)) {
      console.log('LOG [%s] %s', entry.level.name, entry.message, capabilities);
    } else if (verbose) {
      console.log('Skipping log');
    }
  }
}

export const takeScreenshot = async (driver: webdriver.ThenableWebDriver, target: string) => new Promise<void>((resolve) => {
  driver.takeScreenshot().then(data => {
    var base64Data = data.replace(/^data:image\/png;base64,/, "");
    writeFileSync(target, base64Data, 'base64');
    resolve();
  });
});
