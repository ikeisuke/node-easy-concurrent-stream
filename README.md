# EasyConcurrentStream

[![build status](https://circleci.com/gh/ikeisuke/node-easy-concurrent-stream.svg?style=shield&circle-token=4c191000c662ac0bea7d4e1990dd4cef6c882d52)](https://circleci.com/gh/ikeisuke/node-easy-concurrent-stream)
[![npm version](https://badge.fury.io/js/easy-concurrent-stream.svg)](https://www.npmjs.com/package/easy-concurrent-stream)
[![Code Climate](https://codeclimate.com/github/ikeisuke/node-easy-concurrent-stream/badges/gpa.svg)](https://codeclimate.com/github/ikeisuke/node-easy-concurrent-stream)
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

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
