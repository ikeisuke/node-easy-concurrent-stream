# EasyConcurrentStream

![build status](https://circleci.com/gh/ikeisuke/node-easy-concurrent-stream.svg?style=shield&circle-token=4c191000c662ac0bea7d4e1990dd4cef6c882d52)

Create concurrent transform stream from an asyncronous function.


## How to use

Interface compatible with buildin stream.Transform
https://nodejs.org/api/stream.html#stream_implementing_a_transform_stream

```javascript
const Transform = require('easy-concurrent-stream').Transform;

const transform = new Transform({
  transform: function(chunk, encoding, callback) {
    async_function(chunk, function(data){
      callback(null, data);
    });
  },
  flush: function(callback) {
    // optionally
    // when remaining data has been flushed.
    callback();
  }
});
```
