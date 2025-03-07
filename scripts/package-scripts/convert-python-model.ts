import yargs from 'yargs';
import path from 'path';
import { existsSync, fstat, mkdirp } from 'fs-extra';
import { runDocker } from './utils/runDocker';
import { getString, getStringArray } from './prompt/getString';

/****
 * Type Definitions
 */
type Callback = (modelPath: string) => void;

/****
 * Constants
 */

/****
 * Main function
 */
const convertPythonModel = async (_modelPath: string | string[], outputDirectory: string, callback?: Callback): Promise<void> => {
  // if (path.isAbsolute(_outputDirectory)) {
  //   throw new Error('For an output directory, you must specify a single name of the model folder, it looks like you specified an absolute path.')
  // }
  let modelPaths = _modelPath;
  if (typeof modelPaths === 'string') {
    modelPaths = [modelPaths];
  }
  for (const modelPath of modelPaths) {
    if (!path.isAbsolute(modelPath)) {
      throw new Error('The model path is not an absolute path.');
    }
    if (callback) {
      callback(modelPath);
    }
    await mkdirp(outputDirectory);
    const inputFolder = path.resolve(path.dirname(modelPath));
    const modelName = modelPath.split('/').pop();
    const outputName = modelName?.split('.').slice(0, -1).join('.');
    if (!outputName) {
      throw new Error(`No output name was found for model name ${modelName}`);
    }
    await runDocker('evenchange4/docker-tfjs-converter', [
      'tensorflowjs_converter',
      '--input_format=keras',
      `/model/${modelName}`,
      `/output/${outputName}`,
    ].join(' '), {
      volumes: [
        {
          internal: '/model',
          external: inputFolder,
        },
        {
          internal: '/output',
          external: path.resolve(outputDirectory),
        },
      ]
    });
    // assert that file exists
    const expectedOutput = path.resolve(outputDirectory, outputName);
    if (!existsSync(expectedOutput)) {
      throw new Error(`File was not found at ${expectedOutput}`);
    }
  }
};

export default convertPythonModel;

/****
 * Functions to expose the main function as a CLI tool
 */

type Answers = { modelPath: string[]; outputDirectory: string }

const getArgs = async (): Promise<Answers> => {
  const argv = await yargs.command('convert python model', 'build models', yargs => {
    yargs.positional('model', {
      describe: 'The model to build',
    }).options({
      output: { type: 'string', description: 'The model package to place model outputs' },
    });
  })
    .help()
    .argv;

  const modelPath = await getStringArray('Which hdf5 model do you want to build? (You can specify multiple models by separating their paths with a space.)', argv._);
  const outputDirectory = await getString('What output folder do you want to write the output to? If the folder does not exist, it will be created.', argv.output);

  return {
    modelPath,
    outputDirectory,
  }
}

if (require.main === module) {
  (async () => {
    const { modelPath, outputDirectory } = await getArgs();
    convertPythonModel(modelPath, outputDirectory, modelPath => {
      console.log(`** Converting model ${modelPath}`);
    });
  })();
}
