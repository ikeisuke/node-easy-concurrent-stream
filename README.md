# EasyConcurrentStream

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
