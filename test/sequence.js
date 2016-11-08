'use strict';

const assert = require('assert')
    , ConcurrentTransform = require('../index').Transform
    ;

describe('ConcurrentTransform(sequential)', function(){
  it('writable side consumption', function(done){
    let transformed = 0;
    const map = new ConcurrentTransform({
      highWaterMark: 10,
      concurrency: 4,
      transform: function(chunk, encoding, callback) {
        transformed += chunk.length;
        this.push(chunk);
        callback();
      }
    });
    for (var i = 1; i <= 10; i++) {
      map.write(new Buffer(i));
    }
    map.end();
    assert.strictEqual(map._readableState.length, 10);
    assert.strictEqual(map._writableState.length, 45);
    assert.strictEqual(map._transformState.transforming, 0);
    assert.strictEqual(transformed, 10);
    done();
  });
  it('writable side consumption (async)', function(done){
    let transformed = 0;
    const map = new ConcurrentTransform({
      highWaterMark: 10,
      concurrency: 4,
      transform: function(chunk, encoding, callback) {
        setImmediate(() => {
          transformed += chunk.length;
          this.push(chunk);
          callback();
        });
      }
    });
    for (var i = 1; i <= 10; i++) {
      map.write(new Buffer(i));
    }
    map.end();

    assert.strictEqual(map._readableState.length, 0);
    assert.strictEqual(map._writableState.length, 45);
    assert.strictEqual(map._transformState.transforming, 4);
    assert.strictEqual(transformed, 0);
    setImmediate(() => {
      assert.strictEqual(map._readableState.length, 10);
      assert.strictEqual(map._writableState.length, 27);
      assert.strictEqual(map._transformState.transforming, 3);
      assert.strictEqual(transformed, 10);
      done();
    });
  });
  it('paththrogh', function(done){
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    map.write(new Buffer('foog'));
    map.write(new Buffer('bark'));
    map.write(new Buffer('bazy'));
    map.write(new Buffer('kuel'));
    map.end();

    const result = function* () {
      yield 'foogb';
      yield 'arkba';
      yield 'zykue';
      yield 'l';
    }
    const gen = result();
    while(true) {
      const data = map.read(5);
      if(data === null) {
        break;
      }
      assert.strictEqual(data.toString(), gen.next().value);
    }
    done();
  });
  it('object paththrough', function(done){
    const map = ConcurrentTransform({
      objectMode: true,
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    const result = function* () {
      yield 1;
      yield true;
      yield false;
      yield 0;
      yield 'foo';
      yield '';
      yield { a: 'b' };
    }
    let gen = result();
    for(let i=0; i<7; i++){
      map.write(gen.next().value);
    }
    map.end();

    gen = result();
    while(true) {
      const data = map.read();
      if(data === null) {
        break;
      }
      assert.deepStrictEqual(data, gen.next().value);
    }
    done();
  }),
  it('simple transform', function(done){
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        var ret = new Buffer(Array(chunk.length).fill('x').join(""), 'utf-8');
        this.push(ret);
        callback();
      }
    });
    map.write(new Buffer('foog'));
    map.write(new Buffer('bark'));
    map.write(new Buffer('bazy'));
    map.write(new Buffer('kuel'));
    map.end();

    const result = function* () {
      yield 'xxxxx';
      yield 'xxxxx';
      yield 'xxxxx';
      yield 'x';
    }
    const gen = result();
    while(true) {
      const data = map.read(5);
      if(data === null) {
        break;
      }
      assert.strictEqual(data.toString(), gen.next().value);
    }
    done();
  }),
  it('simple object transform', function(done){
    const map = ConcurrentTransform({
      objectMode: true,
      transform: function(chunk, encoding, callback){
        this.push(JSON.stringify(chunk));
        callback();
      }
    });
    const result = function* () {
      yield 1;
      yield true;
      yield false;
      yield 0;
      yield 'foo';
      yield '';
      yield { a: 'b' };
    }
    let gen = result();
    for(let i=0; i<7; i++){
      map.write(gen.next().value);
    }
    map.end();

    gen = result();
    while(true) {
      const data = map.read();
      if(data === null) {
        break;
      }
      assert.deepStrictEqual(data, JSON.stringify(gen.next().value));
    }
    done();
  }),
  it('async passthrough', function(done){
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        setTimeout(function(){
          callback(null, chunk);
        }, 10);
      }
    });
    map.write(new Buffer('foog'));
    map.write(new Buffer('bark'));
    map.write(new Buffer('bazy'));
    map.write(new Buffer('kuel'));
    map.end();

    const result = function* () {
      yield 'foogb';
      yield 'arkba';
      yield 'zykue';
      yield 'l';
    }
    const gen = result();
    map.on('readable', function(){
      while(true) {
        const data = map.read(5);
        if(data === null) {
          break;
        }
        assert.strictEqual(data.toString(), gen.next().value);
      }
    });
    map.on('end', function(){
      done();
    });
  }),
  it('assymetric transform (expand)', function(done){
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        setTimeout(() => {
          this.push(chunk);
          setTimeout(() => {
            this.push(chunk);
            callback();
          }, 10);
        }, 10)
      }
    });
    map.write(new Buffer('foog'));
    map.write(new Buffer('bark'));
    map.write(new Buffer('bazy'));
    map.write(new Buffer('kuel'));
    map.end();

    const result = function* () {
      yield 'foogf';
      yield 'oogba';
      yield 'rkbar';
      yield 'kbazy';
      yield 'bazyk';
      yield 'uelku';
      yield 'el';
    }
    const gen = result();
    map.on('readable', function(){
      while(true) {
        const data = map.read(5);
        if(data === null) {
          return;
        }
        assert.strictEqual(data.toString(), gen.next().value);
      }
    });
    map.on('end', function(){
      done();
    });
  }),
  it('assymetric transform (compress)', function(done) {
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        if (!chunk) {
          chunk = '';
        }
        let s = chunk.toString();
        setTimeout(() => {
          map.state += s.charAt(0);
          if (map.state.length === 3) {
            this.push(new Buffer(map.state));
            map.state = '';
          }
          callback();
        }, 10);
      },
      flush: function(callback) {
        this.push(new Buffer(this.state));
        this.state = '';
        callback();
      }
    });
    map.state = '';
    map.write(new Buffer('aaaa'));
    map.write(new Buffer('bbbb'));
    map.write(new Buffer('cccc'));
    map.write(new Buffer('dddd'));
    map.write(new Buffer('eeee'));
    map.write(new Buffer('aaaa'));
    map.write(new Buffer('bbbb'));
    map.write(new Buffer('cccc'));
    map.write(new Buffer('dddd'));
    map.write(new Buffer('eeee'));
    map.write(new Buffer('aaaa'));
    map.write(new Buffer('bbbb'));
    map.write(new Buffer('cccc'));
    map.write(new Buffer('dddd'));
    map.end();

    const result = function* () {
      yield 'abcde';
      yield 'abcde';
      yield 'abcd';
    }
    const gen = result();
    map.on('readable', function(){
      while(true) {
        const data = map.read(5);
        if(data === null) {
          return;
        }
        assert.strictEqual(data.toString(), gen.next().value);
      }
    });
    map.on('end', function() {
      done();
    })
  }),
  it('complex transform', function(done){
    let count = 0;
    let saved = null;
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        if (count++ === 1 ) {
          saved = chunk
        } else {
          if (saved) {
            this.push(saved);
            saved = null;
          }
          this.push(chunk);
        }
        callback();
      }
    });
    map.once('readable', function(){
      process.nextTick(() => {
        this.write(new Buffer('d'));
        this.write(new Buffer('ef'), () => {
          this.end();
          done();
        });
        setImmediate(() => {
          assert.strictEqual(this.read().toString(), 'abcdef');
          assert.strictEqyal(thus.read(), null);
        });
      })
    });
    map.write('abc');
  }),
  it('passthrough event emission', function(done){
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    let emits = 0;
    map.on('readable', function() {
      emits++;
    });
    map.write(new Buffer('foog'));
    map.write(new Buffer('bark'));

    assert.strictEqual(emits, 1);
    assert.strictEqual(map.read(5).toString(), 'foogb');
    assert.strictEqual(map.read(5), null);

    map.write(new Buffer('bazy'));
    map.write(new Buffer('kuel'));

    assert.strictEqual(emits, 2);

    assert.strictEqual(map.read(5).toString(), 'arkba');
    assert.strictEqual(map.read(5).toString(), 'zykue');
    assert.strictEqual(map.read(5), null);

    map.end();

    assert.strictEqual(emits, 3);
    assert.strictEqual(map.read(5).toString(), 'l');
    assert.strictEqual(map.read(5), null);
    assert.strictEqual(emits, 3);
    done();
  }),
  it('passthrough event emission reordered', function(done){
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    let emits = 0;
    map.on('readable', function() {
      emits++;
    });
    map.write(new Buffer('foog'));
    map.write(new Buffer('bark'));

    assert.strictEqual(emits, 1);
    assert.strictEqual(map.read(5).toString(), 'foogb');
    assert.strictEqual(map.read(5), null);

    map.once('readable', function(){
      assert.strictEqual(map.read(5).toString(), 'arkba');
      assert.strictEqual(map.read(5), null);
      map.once('readable', function(){
        assert.strictEqual(map.read(5).toString(), 'zykue');
        assert.strictEqual(map.read(5), null);
        map.once('readable', function(){
          assert.strictEqual(map.read(5).toString(), 'l');
          assert.strictEqual(map.read(5), null);
          assert.strictEqual(emits, 4);
          done();
        });
        setImmediate(() => {
          // TODO: I have no idea, why it need to call with setImmediate().
          map.end();
        })
      });
      map.write(new Buffer('kuel'));
    });
    map.write(new Buffer('bazy'));
  }),
  it('passthrough facaded', function(done){
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    const datas = [];
    map.on('data', function(chunk) {
      datas.push(chunk.toString());
    });
    map.on('end', function(){
      assert.deepStrictEqual(datas, ['foog', 'bark', 'bazy', 'kuel']);
      done();
    });
    map.write(new Buffer('foog'));
    setTimeout(function(){
      map.write(new Buffer('bark'));
      setTimeout(function(){
        map.write(new Buffer('bazy'));
        setTimeout(function(){
          map.write(new Buffer('kuel'));
          setTimeout(function(){
            map.end();
          }, 10);
        }, 10);
      }, 10);
    }, 10);
  }),
  it('object transform (json parse)', function(done){
    const map = ConcurrentTransform({
      objectMode: true,
      transform: function(chunk, encoding, callback){
        try {
          this.push(JSON.parse(chunk));
          callback();
        } catch (err) {
          callback(err);
        }
      }
    });
    let ended = false;
    map.on('end', function(){
      ended = true;
    });
    const objects = [
      { foo: 'bar' },
      100,
      'string',
      { nested: { things: [ { foo: 'bar' }, 100, 'string' ] } }
    ];
    objects.forEach(function(obj){
      map.write(JSON.stringify(obj));
      assert.deepStrictEqual(map.read(), obj);
    });
    map.end();
    setImmediate(function(){
      map.read();
      process.nextTick(function(){
        assert.strictEqual(ended, true);
        done();
      });
    });
  });
  it('object transform (json stringify)', function(done){
    const map = ConcurrentTransform({
      objectMode: true,
      transform: function(chunk, encoding, callback){
        try {
          this.push(JSON.stringify(chunk));
          callback();
        } catch (err) {
          callback(err);
        }
      }
    });
    let ended = false;
    map.on('end', function(){
      ended = true;
    });
    const objects = [
      { foo: 'bar' },
      100,
      'string',
      { nested: { things: [ { foo: 'bar' }, 100, 'string' ] } }
    ];
    objects.forEach(function(obj){
      map.write(obj);
      setImmediate(() => {
        assert.deepStrictEqual(map.read(), JSON.stringify(obj));
      });
    });
    map.end();
    setImmediate(function(){
      map.read();
      process.nextTick(function(){
        assert.strictEqual(ended, true);
        done();
      });
    });
  });
  it('emit custom event in transform', function(done){
    const map = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        this.emit('custom', chunk);
        callback(null, chunk);
      }
    });

    const result = function* () {
      yield 'foog';
      yield 'bark';
      yield 'bazy';
      yield 'kuel';
    }
    const gen = result();
    map.on('custom', function(data){
      assert.strictEqual(data.toString(), gen.next().value);
    });

    map.write(new Buffer('foog'));
    map.write(new Buffer('bark'));
    map.write(new Buffer('bazy'));
    map.write(new Buffer('kuel'));
    map.end();

    done();
  });
});
