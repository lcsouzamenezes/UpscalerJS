# Node.js Example

Demonstates how to use UpscalerJS within a Node.js context.

<a href="https://githubbox.com/thekevinscott/upscalerjs/tree/main/examples/nodejs">Open in CodeSandbox</a>.

## Code

[Tensorflow.js publishes two different libraries for Node.js](https://www.tensorflow.org/js/guide/nodejs), depending on whether GPU support is required.

Similarly, UpscalerJS provides platform-specific builds that parallel Tensorflow.js's platforms.

:::note

Technically, importing `@tensorflow/tfjs` is supported on the server, but importing `upscaler` alongside it is _not_ supported. For Node.js support you'll need to use one of `tfjs-node` or `tfjs-node-gpu`. If support for `tfjs` on the server is important to you, [open a feature request](https://github.com/thekevinscott/UpscalerJS/issues/new/choose)!

:::

In this example, we'll be using the Node.js CPU platform. 

**Ensure we load UpscalerJS via** `upscaler/node`, _not_ `upscaler`:

```javascript
const tf = require('@tensorflow/tfjs-node')
const Upscaler = require('upscaler/node') // this is important!

const upscaler = new Upscaler()
const image = tf.node.decodeImage(fs.readFileSync('/path/to/image.png'), 3)
const tensor = await upscaler.upscale(image)
const upscaledTensor = await tf.node.encodePng(tensor)
fs.writeFileSync('/path/to/upscaled/image.png', upscaledTensor)

// dispose the tensors!
image.dispose()
tensor.dispose()
upscaledTensor.dispose()
```

Like the browser version of UpscalerJS, the Node.js version will make a best effort to handle any input we throw at it. The list of supported inputs includes a string to a file path, a `Buffer`, a `UInt8Array`, or a tensor.

By default, UpscalerJS will return a tensor when running in Node.js. We can change this to return a base64 string by explicitly specifying the output:

```javascript
const tensor = await upscaler.upscale(image, {
  output: 'base64',
})
```

Next, read about how to specify a custom model when running under Node.js.