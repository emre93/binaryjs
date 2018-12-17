// if node
var Stream = require('stream').Stream;
var EventEmitter = require('events').EventEmitter;
var BufferReadStream = require('streamers').BufferReadStream;
var WebSocket = require('streamws');

var util = require('./util');
var BinaryStream = require('./stream').BinaryStream;

let BinaryServer = require('./server');
var a = true;
var j;
var b = true;
var ID;
// end node




function BinaryClient(socket, options) {
  if (!(this instanceof BinaryClient)) return new BinaryClient(socket, options);
  
  EventEmitter.call(this);
  
  var self = this;
 // console.log("HMMMM");
  j=1;

  this._options = util.extend({
    chunkSize: 800
  }, options);



//streamId = BinaryServer.updateStreamId();
// this.BinaryServer.close= function(socket){

//     streamId++;
//     console.log(streamId);
// };
  //  this.streams = {};
  // this._streamCounter = 0;
  
// var binaryServer = new BinaryServer(options);
// this.binaryServer.addEventListener('connection', function(socket){
//     //var StreamId = self._streamCounter;
//     //console.log("Connection!!!!!!!!!!!!!!");
    
//     streamId++
//     console.log("StreamId in here: " , streamId);
//     //self.clients[clientId] = binaryClient;
//     //self._clientCounter++;
    
//     // binaryClient.on('close', function(){
//     //   delete self.clients[clientId];
//     // });
//     //self.emit('connection', binaryClient);
//   });



  this.streams = {};
  
  if(typeof socket === 'string') {
    this._nextId = 0;
    ID = this._nextId;
    //if (ID != 0) ID += 2;
    this._socket = new WebSocket(socket);
  } else {
    // Use odd numbered ids for server originated streams
    this._nextId = 1;
    ID = this._nextId;
    //if (ID != 1) ID += 2 ;
    this._socket = socket;
   
  }
  
  this._socket.binaryType = 'arraybuffer';
  
  this._socket.addEventListener('open', function(){ 
    self.emit('open');
  });
 
  // if node
  this._socket.on('drain', function(){
    var ids = Object.keys(self.streams);
    for (var i = 0, ii = ids.length; i < ii; i++) {
      self.streams[ids[i]]._onDrain();
    }
  });
  // end node
  this._socket.addEventListener('error', function(error){
    var ids = Object.keys(self.streams);
    for (var i = 0, ii = ids.length; i < ii; i++) {
      self.streams[ids[i]]._onError(error);
    }
    self.emit('error', error);
  });
  this._socket.addEventListener('close', function(code, message){
    var ids = Object.keys(self.streams);
    j=1;
    //streamId--;
    for (var i = 0, ii = ids.length; i < ii; i++) {
      self.streams[ids[i]]._onClose();
    }
    self.emit('close', code, message);
  });
  this._socket.addEventListener('message', function(data, flags){

    
    //console.log(flags);
    util.setZeroTimeout(function(){

       data = data.data;

      // Message format
      // [type, payload, bonus ]
      //
      // Reserved
      // [ 0  , X , X ]
      // 
      //
      // New stream
      // [ 1  , Meta , new streamId ]
      // 
      //
      // Data
      // [ 2  , Data , streamId ]
      // 
      //
      // Pause
      // [ 3  , null , streamId ]
      // 
      //
      // Resume
      // [ 4  , null , streamId ]
      // 
      //
      // End
      // [ 5  , null , streamId ]
      // 
      //
      // Close
      // [ 6  , null , streamId ]
      // 
    //if(a) {console.log(data.data); setTimeout(function(){ a = false; }, 1000); console.log("Timeout");}

    // if (streamId)
   
    data = [j,data, ID];
    //console.log(ID);
     j = 2;
    
  //console.log("streamId",streamId);
  
    //console.log(data);
    //setTimeout(function(){   data = [5,null,0]; }, 100);
      // try {
      //     data = util.unpack(data);

             
      // } catch (ex) {
      //     return self.emit('error', new Error('Received unparsable message: ' + ex));
      // }
      if (!(data instanceof Array))
          return self.emit('error', new Error('Received non-array message'));
      if (data.length != 3)
          return self.emit('error', new Error('Received message with wrong part count: ' + data.length));
      if ('number' != typeof data[0])
          return self.emit('error', new Error('Received message with non-number type: ' + data[0]));
 
      switch(data[0]) {
        case 0:
          // Reserved
          break;
        case 1:
          var meta = data[1];
          var streamId = data[2];
          var binaryStream = self._receiveStream(streamId);
          self.emit('stream', binaryStream, meta);
          break;
        case 2:
          var payload = data[1];
          var streamId = data[2];
          var binaryStream = self.streams[streamId];
          if(binaryStream) {
            binaryStream._onData(payload);
          } else {
            self.emit('error', new Error('Received `data` message for unknown stream: ' + streamId));
          }
          break;
        case 3:
          var streamId = data[2];
          var binaryStream = self.streams[streamId];
          if(binaryStream) {
            binaryStream._onPause();
          } else {
            self.emit('error', new Error('Received `pause` message for unknown stream: ' + streamId));
          }
          break;
        case 4:
          var streamId = data[2];
          var binaryStream = self.streams[streamId];
          if(binaryStream) {
            binaryStream._onResume();
          } else {
            self.emit('error', new Error('Received `resume` message for unknown stream: ' + streamId));
          }
          break;
        case 5:
          var streamId = data[2];
          var binaryStream = self.streams[streamId];
          if(binaryStream) {
            binaryStream._onEnd();
          } else {
            self.emit('error', new Error('Received `end` message for unknown stream: ' + streamId));
          }
          break;
        case 6:
          var streamId = data[2];
          var binaryStream = self.streams[streamId];
          if(binaryStream) {
            binaryStream._onClose();
          } else {
            self.emit('error', new Error('Received `close` message for unknown stream: ' + streamId));
          }
          break;
        default:
          self.emit('error', new Error('Unrecognized message type received: ' + data[0]));
      }
    });
  });
}

util.inherits(BinaryClient, EventEmitter);

BinaryClient.prototype.send = function(data, meta){
  var stream = this.createStream(meta);
  //console.log("How about now");
  if(data instanceof Stream) {
    data.pipe(stream);
  } else if (util.isNode === true) {
    if(Buffer.isBuffer(data)) {
      (new BufferReadStream(data, {chunkSize: this._options.chunkSize})).pipe(stream);
    } else {
      stream.write(data);
    } 
  } else if (util.isNode !== true) {
    if(data.constructor == Blob || data.constructor == File) {
      (new BlobReadStream(data, {chunkSize: this._options.chunkSize})).pipe(stream);
    } else if (data.constructor == ArrayBuffer) {
      var blob;
      if(binaryFeatures.useArrayBufferView) {
        data = new Uint8Array(data);
      }
      if(binaryFeatures.useBlobBuilder) {
        var builder = new BlobBuilder();
        builder.append(data);
        blob = builder.getBlob()
      } else {
        blob = new Blob([data]);
      }
      (new BlobReadStream(blob, {chunkSize: this._options.chunkSize})).pipe(stream);
    } else if (typeof data === 'object' && 'BYTES_PER_ELEMENT' in data) {
      var blob;
      if(!binaryFeatures.useArrayBufferView) {
        // Warn
        data = data.buffer;
      }
      if(binaryFeatures.useBlobBuilder) {
        var builder = new BlobBuilder();
        builder.append(data);
        blob = builder.getBlob()
      } else {
        blob = new Blob([data]);
      }
      (new BlobReadStream(blob, {chunkSize: this._options.chunkSize})).pipe(stream);
    } else {
      stream.write(data);
    }
  }
  return stream;
};

BinaryClient.prototype._receiveStream = function(streamId){
  var self = this;

  var binaryStream = new BinaryStream(this._socket, ID, false);
  //streamId = ID;
  //console.log("StreamId: " + streamId);
  console.log("Connection opened");
  //ID++;
  //console.log("ID: " + ID);
 
  // if (b == true && streamId !== 1) {
  //   j=1;
  //   b = false;
  //   console.log("It is here! ");
  // }
  binaryStream.on('close', function(){
    delete self.streams[streamId];
  });
  this.streams[streamId] = binaryStream;
  return binaryStream;
};

BinaryClient.prototype.createStream = function(meta){
  if(this._socket.readyState !== WebSocket.OPEN) {
    throw new Error('Client is not yet connected or has closed');
    return;
  }
  var self = this;
  //console.log("How about now");
  var streamId = this._nextId;
  
  //j=1;
  //console.log(streamId);
  this._nextId += 2;
  var binaryStream = new BinaryStream(this._socket, streamId, true, meta);
  binaryStream.on('close', function(){
    delete self.streams[streamId];
  });
  this.streams[streamId] = binaryStream;
  return binaryStream;
};

BinaryClient.prototype.close = BinaryClient.prototype.destroy = function() {
  this._socket.close();
};

exports.BinaryClient = BinaryClient;
