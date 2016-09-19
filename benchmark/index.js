'use strict';

const fs = require('fs');
const tempfile = require('tempfile');

const ConcurrentTransform = require('../index').Transform;
const Transform = require('stream').Transform;

let rs = null, ts = null, ws = null;

const temp = tempfile();
rs = fs.createReadStream('/dev/urandom', {start:0, end: 1024 * 1024 * 100 - 1})
ws = fs.createWriteStream(temp);
rs.pipe(ws).on('finish', function(){
  rs = fs.createReadStream(temp);
  ws = fs.createWriteStream('/dev/null');
  console.time('no transform');
  rs.pipe(ws).on('finish', function(){
    console.timeEnd('no transform');
    rs = fs.createReadStream(temp);
    ts = new Transform({
      transform: function(chunk, encoding, callback) {
        callback(null, chunk);
      },
      flush: function(callback) {
        callback();
      }
    });
    ws = fs.createWriteStream('/dev/null');
    console.time('builtin sync');
    rs.pipe(ts).pipe(ws).on('finish', function(){
      console.timeEnd('builtin sync');
      rs = fs.createReadStream(temp);
      ts = new Transform({
        transform: function(chunk, encoding, callback) {
          setImmediate(()  => {
            callback(null, chunk);
          });
        },
        flush: function(callback) {
          callback();
        }
      });
      ws = fs.createWriteStream('/dev/null');
      console.time('builtin async');
      rs.pipe(ts).pipe(ws).on('finish', function(){
        console.timeEnd('builtin async');
        rs = fs.createReadStream(temp);
        ts = new ConcurrentTransform({
          transform: function(chunk, encoding, callback) {
            callback(null, chunk);
          },
          flush: function(callback) {
            callback();
          }
        });
        ws = fs.createWriteStream('/dev/null');
        console.time('concurrent sequence sync');
        rs.pipe(ts).pipe(ws).on('finish', function(){
          console.timeEnd('concurrent sequence sync');
          rs = fs.createReadStream(temp);
          ts = new ConcurrentTransform({
            transform: function(chunk, encoding, callback) {
              setImmediate(() => {
                callback(null, chunk);
              });
            },
            flush: function(callback) {
              callback();
            }
          });
          ws = fs.createWriteStream('/dev/null');
          console.time('concurrent sequence async');
          rs.pipe(ts).pipe(ws).on('finish', function(){
            console.timeEnd('concurrent sequence async');
            rs = fs.createReadStream(temp);
            ts = new ConcurrentTransform({
              transform: function(chunk, encoding, callback) {
                callback(null, chunk);
              },
              flush: function(callback) {
                callback();
              }
            });
            ws = fs.createWriteStream('/dev/null');
            console.time('concurrent sync');
            rs.pipe(ts).pipe(ws).on('finish', function(){
              console.timeEnd('concurrent sync');
              rs = fs.createReadStream(temp);
              ts = new ConcurrentTransform({
                transform: function(chunk, encoding, callback) {
                  setImmediate(() => {
                    callback(null, chunk);
                  });
                },
                flush: function(callback) {
                  callback();
                }
              });
              ws = fs.createWriteStream('/dev/null');
              console.time('concurrent async');
              rs.pipe(ts).pipe(ws).on('finish', function(){
                console.timeEnd('concurrent async');
                fs.unlinkSync(temp)
              });
            });
          });
        });
      });
    });
  });
});
