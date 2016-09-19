'use strict';

const assert = require('assert')
    , ConcurrentTransform = require('../index').Transform
    ;

describe('ConcurrentTransform', function(){
  it('writable side consumption', function(){
    let transformed = 0;
    const nowait = new ConcurrentTransform({
      highWaterMark: 10,
      concurrency: 4,
      sequential: false,
      transform: function(chunk, encoding, callback) {
        transformed += chunk.length;
        callback(null, chunk);
      }
    });
    for (var i = 1; i <= 10; i++) {
      nowait.write(Buffer.allocUnsafe(i));
    }
    nowait.end();
    assert.strictEqual(nowait._readableState.length, 10);
    assert.strictEqual(nowait._writableState.length, 45);
    assert.strictEqual(nowait._transformState.transforming, 0);
    assert.strictEqual(transformed, 10);
  });
  it('writable side consumption (async)', function(done){
    let transformed = 0;
    const nowait = new ConcurrentTransform({
      highWaterMark: 10,
      concurrency: 4,
      sequential: false,
      transform: function(chunk, encoding, callback) {
        setImmediate(() => {
          transformed += chunk.length;
          callback(null, chunk);
        });
      }
    });
    for (var i = 1; i <= 10; i++) {
      nowait.write(Buffer.allocUnsafe(i));
    }
    nowait.end();

    assert.strictEqual(nowait._readableState.length, 0);
    assert.strictEqual(nowait._writableState.length, 45);
    assert.strictEqual(nowait._transformState.transforming, 4);
    assert.strictEqual(transformed, 0);
    setImmediate(() => {
      assert.strictEqual(nowait._readableState.length, 10);
      assert.strictEqual(nowait._writableState.length, 27);
      assert.strictEqual(nowait._transformState.transforming, 3);
      assert.strictEqual(transformed, 10);
      done();
    });
  });
  it('paththrogh', function(done){
    const nowait = ConcurrentTransform({
      sequential: false,
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    nowait.write(Buffer.from('foog'));
    nowait.write(Buffer.from('bark'));
    nowait.write(Buffer.from('bazy'));
    nowait.write(Buffer.from('kuel'));
    nowait.end();

    const result = function* () {
      yield 'foogb';
      yield 'arkba';
      yield 'zykue';
      yield 'l';
    }
    const gen = result();
    while(true) {
      const data = nowait.read(5);
      if(data === null) {
        break;
      }
      assert.strictEqual(data.toString(), gen.next().value);
    }
    done();
  });
  it('object paththrough', function(done){
    const nowait = ConcurrentTransform({
      objectMode: true,
      sequential: false,
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
      nowait.write(gen.next().value);
    }
    nowait.end();

    gen = result();
    while(true) {
      const data = nowait.read();
      if(data === null) {
        break;
      }
      assert.deepStrictEqual(data, gen.next().value);
    }
    done();
  }),
  it('simple transform', function(done){
    const nowait = ConcurrentTransform({
      sequential: false,
      transform: function(chunk, encoding, callback){
        var ret = Buffer.alloc(chunk.length, 'x');
        this.push(ret);
        callback();
      }
    });
    nowait.write(Buffer.from('foog'));
    nowait.write(Buffer.from('bark'));
    nowait.write(Buffer.from('bazy'));
    nowait.write(Buffer.from('kuel'));
    nowait.end();

    const result = function* () {
      yield 'xxxxx';
      yield 'xxxxx';
      yield 'xxxxx';
      yield 'x';
    }
    const gen = result();
    while(true) {
      const data = nowait.read(5);
      if(data === null) {
        break;
      }
      assert.strictEqual(data.toString(), gen.next().value);
    }
    done();
  }),
  it('simple object transform', function(done){
    const nowait = ConcurrentTransform({
      objectMode: true,
      sequential: false,
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
      nowait.write(gen.next().value);
    }
    nowait.end();

    gen = result();
    while(true) {
      const data = nowait.read();
      if(data === null) {
        break;
      }
      assert.deepStrictEqual(data, JSON.stringify(gen.next().value));
    }
    done();
  }),
  it('async passthrough', function(done){
    const nowait = ConcurrentTransform({
      sequential: false,
      transform: function(chunk, encoding, callback){
        setTimeout(function(){
          callback(null, chunk);
        }, 10);
      }
    });
    nowait.write(Buffer.from('foog'));
    nowait.write(Buffer.from('bark'));
    nowait.write(Buffer.from('bazy'));
    nowait.write(Buffer.from('kuel'));
    nowait.end();

    const result = function* () {
      yield 'foogb';
      yield 'arkba';
      yield 'zykue';
      yield 'l';
    }
    const gen = result();
    nowait.on('readable', function(){
      while(true) {
        const data = nowait.read(5);
        if(data === null) {
          break;
        }
        assert.strictEqual(data.toString(), gen.next().value);
      }
    });
    nowait.on('end', function(){
      done();
    });
  }),
  it('assymetric transform (expand)', function(done){
    const nowait = ConcurrentTransform({
      sequential: false,
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
    nowait.write(Buffer.from('foog'));
    nowait.write(Buffer.from('bark'));
    nowait.write(Buffer.from('bazy'));
    nowait.write(Buffer.from('kuel'));
    nowait.end();

    let result = '';
    nowait.on('readable', function(){
      while(true) {
        const data = nowait.read(5);
        if(data === null) {
          return;
        }
        result += data.toString();
      }
    });
    nowait.on('end', function(){
      assert.strictEqual(result.split('').sort().join(''), 'aaaabbbbeeffggkkkklloooorruuyyzz');
      done();
    });
  }),
  it('assymetric transform (compress)', function(done) {
    const nowait = ConcurrentTransform({
      sequential: false,
      transform: function(chunk, encoding, callback){
        if (!chunk) {
          chunk = '';
        }
        var s = chunk.toString();
        setTimeout(() => {
          this.state += s.charAt(0);
          if (this.state.length === 3) {
            this.push(Buffer.from(this.state));
            this.state = '';
          }
          callback();
        }, 10);
      },
      flush: function(callback) {
        this.push(Buffer.from(this.state));
        this.state = '';
        callback();
      }
    });
    nowait.state = '';
    nowait.write(Buffer.from('aaaa'));
    nowait.write(Buffer.from('bbbb'));
    nowait.write(Buffer.from('cccc'));
    nowait.write(Buffer.from('dddd'));
    nowait.write(Buffer.from('eeee'));
    nowait.write(Buffer.from('aaaa'));
    nowait.write(Buffer.from('bbbb'));
    nowait.write(Buffer.from('cccc'));
    nowait.write(Buffer.from('dddd'));
    nowait.write(Buffer.from('eeee'));
    nowait.write(Buffer.from('aaaa'));
    nowait.write(Buffer.from('bbbb'));
    nowait.write(Buffer.from('cccc'));
    nowait.write(Buffer.from('dddd'));
    nowait.end();

    let result = '';
    nowait.on('readable', function(){
      while(true) {
        const data = nowait.read(5);
        if(data === null) {
          return;
        }
        result += data.toString();
      }
    });
    nowait.on('end', function() {
      assert.strictEqual(result.split('').sort().join(''), 'aaabbbcccdddee');
      done();
    })
  }),
  it('complex transform', function(done){
    let count = 0;
    let saved = null;
    const nowait = ConcurrentTransform({
      sequential: false,
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
    nowait.once('readable', function(){
      process.nextTick(() => {
        this.write(Buffer.from('d'));
        this.write(Buffer.from('ef'), () => {
          this.end();
          done();
        });
        setImmediate(() => {
          assert.strictEqual(this.read().toString(), 'abcdef');
          assert.strictEqyal(thus.read(), null);
        });
      })
    });
    nowait.write('abc');
  }),
  it('passthrough event emission', function(done){
    const nowait = ConcurrentTransform({
      sequential: false,
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    let emits = 0;
    nowait.on('readable', function() {
      emits++;
    });
    nowait.write(Buffer.from('foog'));
    nowait.write(Buffer.from('bark'));

    assert.strictEqual(emits, 1);
    assert.strictEqual(nowait.read(5).toString(), 'foogb');
    assert.strictEqual(nowait.read(5), null);

    nowait.write(Buffer.from('bazy'));
    nowait.write(Buffer.from('kuel'));

    assert.strictEqual(emits, 2);

    assert.strictEqual(nowait.read(5).toString(), 'arkba');
    assert.strictEqual(nowait.read(5).toString(), 'zykue');
    assert.strictEqual(nowait.read(5), null);

    nowait.end();

    assert.strictEqual(emits, 3);
    assert.strictEqual(nowait.read(5).toString(), 'l');
    assert.strictEqual(nowait.read(5), null);
    assert.strictEqual(emits, 3);
    done();
  }),
  it('passthrough event emission reordered', function(done){
    const nowait = ConcurrentTransform({
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    let emits = 0;
    nowait.on('readable', function() {
      emits++;
    });
    nowait.write(Buffer.from('foog'));
    nowait.write(Buffer.from('bark'));

    assert.strictEqual(emits, 1);
    assert.strictEqual(nowait.read(5).toString(), 'foogb');
    assert.strictEqual(nowait.read(5), null);

    nowait.once('readable', function(){
      assert.strictEqual(nowait.read(5).toString(), 'arkba');
      assert.strictEqual(nowait.read(5), null);
      nowait.once('readable', function(){
        assert.strictEqual(nowait.read(5).toString(), 'zykue');
        assert.strictEqual(nowait.read(5), null);
        nowait.once('readable', function(){
          assert.strictEqual(nowait.read(5).toString(), 'l');
          assert.strictEqual(nowait.read(5), null);
          assert.strictEqual(emits, 4);
          done();
        });
        setImmediate(() => {
          // TODO: I have no idea, why it need to call with setImmediate().
          nowait.end();
        })
      });
      nowait.write(Buffer.from('kuel'));
    });
    nowait.write(Buffer.from('bazy'));
  }),
  it('passthrough facaded', function(done){
    const nowait = ConcurrentTransform({
      sequential: false,
      transform: function(chunk, encoding, callback){
        callback(null, chunk);
      }
    });
    const datas = [];
    nowait.on('data', function(chunk) {
      datas.push(chunk.toString());
    });
    nowait.on('end', function(){
      assert.deepStrictEqual(datas, ['foog', 'bark', 'bazy', 'kuel']);
      done();
    });
    nowait.write(Buffer.from('foog'));
    setTimeout(function(){
      nowait.write(Buffer.from('bark'));
      setTimeout(function(){
        nowait.write(Buffer.from('bazy'));
        setTimeout(function(){
          nowait.write(Buffer.from('kuel'));
          setTimeout(function(){
            nowait.end();
          }, 10);
        }, 10);
      }, 10);
    }, 10);
  }),
  it('object transform (json parse)', function(done){
    const nowait = ConcurrentTransform({
      objectMode: true,
      sequential: false,
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
    nowait.on('end', function(){
      ended = true;
    });
    const objects = [
      { foo: 'bar' },
      100,
      'string',
      { nested: { things: [ { foo: 'bar' }, 100, 'string' ] } }
    ];
    objects.forEach(function(obj){
      nowait.write(JSON.stringify(obj));
      assert.deepStrictEqual(nowait.read(), obj);
    });
    nowait.end();
    setImmediate(function(){
      nowait.read();
      process.nextTick(function(){
        assert.strictEqual(ended, true);
        done();
      });
    });
  });
  it('object transform (json stringify)', function(done){
    const nowait = ConcurrentTransform({
      objectMode: true,
      sequential: false,
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
    nowait.on('end', function(){
      ended = true;
    });
    const objects = [
      { foo: 'bar' },
      100,
      'string',
      { nested: { things: [ { foo: 'bar' }, 100, 'string' ] } }
    ];
    objects.forEach(function(obj){
      nowait.write(obj);
      setImmediate(() => {
        assert.deepStrictEqual(nowait.read(), JSON.stringify(obj));
      });
    });
    nowait.end();
    setImmediate(function(){
      nowait.read();
      process.nextTick(function(){
        assert.strictEqual(ended, true);
        done();
      });
    });
  });
});
