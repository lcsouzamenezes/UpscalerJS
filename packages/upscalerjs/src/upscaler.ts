/**
 * # UpscalerJS class
 * 
 * Instantiate an Upscaler with:
 * 
 * ```typescript
 * import Upscaler from 'upscaler';
 * const upscaler = new Upscaler();
 * upscaler.upscale(img).then(src => {
 *   // display the src
 * });
 * ```
 *
 * @module UpscalerJS
 */
import { DefaultUpscalerModel, tf, } from './dependencies.generated';
import type {
  UpscalerOptions,
  ModelPackage,
  BASE64,
  WarmupArgs,
  UpscaleArgs,
  TENSOR,
  MultiArgStringProgress,
  MultiArgTensorProgress,
  WarmupSizes,
} from './types';
import { getUpscaleOptions, } from './args.generated';
import { loadModel, } from './loadModel.generated';
import { cancellableWarmup, } from './warmup';
import { cancellableUpscale, } from './upscale';
import type { Input, } from './image.generated';
import type { ModelDefinitionObjectOrFn, } from '@upscalerjs/core';
import { getModel, } from './utils';

// TODO: Why do we need to explicitly cast this to ModelDefinition?
// This is an ESLint issue, Typescript picks this up correctly
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const DEFAULT_MODEL: ModelDefinitionObjectOrFn = DefaultUpscalerModel;

export class Upscaler {
  /**
   * @hidden
   */
  _opts: UpscalerOptions;

  /**
   * @hidden
   */
  _model: Promise<ModelPackage>;

  /**
   * @hidden
   */
  _ready: Promise<void>;

  /**
   * @hidden
   */
  _abortController = new AbortController();

  /**
   * Instantiates an instance of UpscalerJS.
   * 
   * ```javascript
   * import Upscaler from 'upscaler';
   * import x2 from '@upscalerjs/models/esrgan-thick/2x';
   * 
   * const upscaler = new Upscaler({
   *   model: x2,
   *   warmupSizes: [{ patchSize: 64 }],
   * });
   * ```
   * 
   * @returns an instance of an UpscalerJS class.
   */
  constructor(opts: UpscalerOptions = {}) {
    this._opts = {
      ...opts,
    };
    this._model = loadModel(getModel(this._opts.model || DEFAULT_MODEL));
    this._ready = cancellableWarmup(this._model, (this._opts.warmupSizes || []), undefined, {
      signal: this._abortController.signal,
    });
  }

  /**
   * Upscales a given image.
   * 
   * ```javascript
   * const upscaler = new Upscaler();
   * const image = new Image();
   * image.src = '/some/path/to/image.png';
   * 
   * upscaler.upscale(image, {
   *   output: 'base64',
   *   patchSize: 64,
   *   padding: 2,
   *   progress: (progress) => {
   *     console.log('Progress:', progress);
   *   },
   * }).then(upscaledSrc => {
   *   console.log(upscaledSrc);
   * });
   * ```
   *
   * @param image The image to upscale.
   * @param options A set of upscaling arguments.
   * @returns an upscaled image.
   */
  public async upscale(
    image: Input,
    options: Omit<UpscaleArgs, 'output' | 'progress' | 'progressOutput'> & { output: TENSOR; progress?: MultiArgStringProgress; progressOutput: BASE64 },
  ): Promise<tf.Tensor3D>;
  public async upscale(
    image: Input,
    options: Omit<UpscaleArgs, 'output' | 'progress' | 'progressOutput'> & { output?: BASE64; progress?: MultiArgTensorProgress; progressOutput: TENSOR },
  ): Promise<string>;
  public async upscale(
    image: Input,
    options: Omit<UpscaleArgs, 'output' | 'progress' | 'progressOutput'> & { output: TENSOR; progress?: MultiArgTensorProgress; progressOutput?: unknown },
  ): Promise<tf.Tensor3D>;
  public async upscale(
    image: Input,
    options: Omit<UpscaleArgs, 'output' | 'progress' | 'progressOutput'> & { output?: BASE64; progress?: MultiArgStringProgress; progressOutput?: unknown },
  ): Promise<string>;
  public async upscale(
    image: Input,
    options: Omit<UpscaleArgs, 'output' | 'progress' | 'progressOutput'> & { output?: TENSOR | BASE64; progress?: MultiArgStringProgress | MultiArgTensorProgress; progressOutput?: unknown },
  ): Promise<tf.Tensor3D | string>;
  public async upscale(
    image: Input,
  ): Promise<string>;
  public async upscale(
    image: Input,
    options?: Omit<UpscaleArgs, 'output' | 'progress' | 'progressOutput'> & { output?: unknown; progress?: MultiArgStringProgress | MultiArgTensorProgress; progressOutput?: unknown },
  ) {
    await this._ready;
    const { model, modelDefinition, } = await this._model;
    return cancellableUpscale(image, getUpscaleOptions(model, options), {
      model,
      modelDefinition,
      signal: this._abortController.signal,
    });
  }

  /**
   * Warms up an Upscaler instance. For more info, [see the guide on warming up](/documentation/guides/browser/performance/warmup).
   * 
   * ```javascript
   * const upscaler = new Upscaler();
   * upscaler.warmup([{
   *   patchSize: 64,
   *   padding: 2,
   * }]).then(() => {
   *   console.log('I am all warmed up!');
   * });
   * ```
   * 
   * @param warmupSizes Denotes how to warm the model up.
   * @param options A set of warm up arguments.
   */
  warmup = async (warmupSizes: WarmupSizes = [], options?: WarmupArgs): Promise<void> => {
    await this._ready;
    return cancellableWarmup(this._model, warmupSizes, options, {
      signal: this._abortController.signal,
    });
  };

  /**
   * Aborts all active asynchronous methods (including upscaling and warm up methods). For more info, [see the guide on cancelling](/documentation/guides/browser/usage/cancel).
   * 
   * ```javascript
   * const upscaler = new Upscaler();
   * upscaler.abort();
   * ```
   */
  abort = (): void => {
    this._abortController.abort();
    this._abortController = new AbortController();
  };

  /**
   * Disposes of an UpscalerJS instance and clears up any used memory. Ensure you've aborted any active upscaling events before disposing of the model.
   * 
   * ```javascript
   * const upscaler = new Upscaler();
   * upscaler.dispose().then(() => {
   *   console.log("I'm all cleaned up!");
   * })
   * ```
   */
  dispose = async (): Promise<void> => {
    await this._ready;
    const { model, } = await this._model;
    model.dispose();
  };

  /**
   * Gets a model package.
   * 
   * ```javascript
   * const upscaler = new Upscaler();
   * upscaler.getModel().then(modelPackage => {
   *   console.log(modelPackage);
   * })
   * ```
   * 
   * @returns a modelPackage object of shape ```{ model: tf.LayersModel, modelDefinition: ModelDefinition }```
   */
  getModel = (): Promise<ModelPackage> => this._model;
}

export default Upscaler;
