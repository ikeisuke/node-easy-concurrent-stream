'use strict';

module.exports = ConcurrentTransform;

const Duplex = require('stream').Duplex;
const util = require('util');

const defaultProperties = [
  "readable", "writable", "domain", "allowHalfOpen"
];

util.inherits(ConcurrentTransform, Duplex);

function ConcurrentTransformState(options, stream) {
  options = options || {};
  this.concurrency = options.concurrency || 8;
  this.sequential = "sequential" in options ? options.sequential : true;
  this.transforming = 0;
  this.backlog = null;
  this.next = null;
  this.buffer = {};
}

function afterTransform(stream, err, data) {
  const ts = stream._transformState;
  ts.transforming--;

  const context = ts.context;
  if (data !== null && data !== undefined) {
    context.push(data);
  }
  if (context !== stream) {
    context.forEach((v) => {
      stream.push(v);
    });
  }

  if (ts.next || ts.backlog) {
    const rs = stream._readableState;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      stream._read();
    }
  } else {
    endTransform(stream);
  }
}

function ConcurrentTransform(options) {
  if (!(this instanceof ConcurrentTransform)) {
    return new ConcurrentTransform(options);
  }

  Duplex.call(this, options);

  this._transformState = new ConcurrentTransformState(options, this);

  this._readableState.needReadable = true;
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') {
      this._transform = options.transform;
    }

    if (typeof options.flush === 'function') {
      this._flush = options.flush;
    }
  }

  const stream = this;
  this.once('transformed', function() {
    if (typeof this._flush === 'function')
      this._flush((err, data) => {
        done(stream, err, data);
      });
    else
      done(stream);
  });
}


ConcurrentTransform.prototype._transform = function(chunk, encoding, callback) {
  throw new Error('Not implemented');
};

ConcurrentTransform.prototype._write = function(chunk, encoding, callback) {
  const ts = this._transformState;
  ts.backlog = {
    chunk: chunk,
    encoding: encoding,
    callback: callback
  };
  if (ts.transforming < ts.concurrency) {
    const rs = this._readableState;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      this._read();
    }
  }
};

ConcurrentTransform.prototype._read = function(n) {
  const ts = this._transformState;
  const backlog = ts.backlog;
  if (backlog) {
    ts.backlog = null;
    if (backlog.chunk !== null && backlog.chunk != undefined) {
      ts.transforming++;
      let context = this;
      let stream = this;
      if (ts.sequential) {
        context = [];
        for(let k in this) {
          if (!this.hasOwnProperty(k)) continue;
          if (k.charAt(0) === '_') continue;
          if (defaultProperties.some((key)=>{ return key === k })) continue;
          if (typeof this[k] === "function") continue;
          Object.defineProperty(context, k, {value: this[k]});
        }
        Object.defineProperty(context, "emit", {value: function() {
          const args = Array.prototype.slice.call(arguments);
          stream.emit.apply(stream, args);
        }});
      }
      this._transform.call(context, backlog.chunk, backlog.encoding, (err, data) => {
        ts.context = context;
        afterTransform(this, err, data);
        ts.context = null;
      });
    }
    if (typeof backlog.callback === "function") {
      backlog.callback();
    }
  }
};

ConcurrentTransform.prototype.end = function(chunk, encoding, callback) {
  Duplex.prototype.end.call(this, chunk, encoding, callback);
  endTransform(this);
};

function endTransform(stream) {
  const ts = stream._transformState;
  const ws = stream._writableState;
  if (ws.ended && ws.length === 0 && ts.transforming === 0) {
    stream.emit('transformed');
  }
}

function done(stream, err, data) {
  if (err) {
    return stream.emit('error', er);
  }

  if (data !== null && data !== undefined) {
    stream.push(data);
  }

  const ws = stream._writableState;
  const ts = stream._transformState;

  if (ws.length) {
    throw new Error('Calling transform done when ws.length != 0');
  }

  if (ts.transforming) {
    throw new Error('Calling transform done when still transforming');
  }

  return stream.push(null);
}
