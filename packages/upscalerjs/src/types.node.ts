import { tf, } from './dependencies.generated';

export type Input = tf.Tensor3D | tf.Tensor4D | string | Uint8Array | Buffer;
