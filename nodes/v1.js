/**
 * Copyright 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
  const jsonexport = require('jsonexport');

  var temp = require('temp'),
    fileType = require('file-type'),
    fs = require('fs');

  temp.track();

  function checkPayload(node, msg, cb) {
    var json = null;

    temp.open({
      suffix: '.json'
    }, function(err, info) {
      if (err) {
        node.status({
          fill: 'red',
          shape: 'dot',
          text: 'Error opening temporary file'
        });
        cb(err, json);
        return;
      }

      // Syncing up the asynchronous nature of the stream
      // so that the full file can be sent to the API.

      // If the payload is a buffer then need to load it in.
      // Note: If the file has an extension of .json, then
      // it is not seen as a buffer, but as a .json file and
      // gets read in as json data, so no buffering or conversion
      // is required.
      if (msg.payload instanceof Buffer) {
        //console.log('Its a Buffer');
        fs.writeFile(info.path, msg.payload, function(err) {
          if (err) {
            node.status({
              fill: 'red',
              shape: 'dot',
              text: 'Error processing data buffer for training'
            });
            cb(err, json);
            return;
          }
          try {
            json = JSON.parse(fs.readFileSync(info.path, 'utf8'));
          }
          catch (err) {
            cb(err.message, json);
          }
          cb(null, json);
          temp.cleanup();
        });
      } else {
        // If we get here then we can treat the msg.payload as a json
        // object. If the file had an extension of .json then this
        // is where it gets processed. Yes, it suprised me also, all the
        // buffering is only required if the file extension is not .json,
        // but still contains json data.
        //console.log('Its not a buffer');
        //console.log(typeof msg.payload);
        json = msg.payload;
        cb(null, json);
      }
    });
  }

  function performConversion(json, cb) {
    jsonexport(json, cb);
  }

  function Node (config) {
    var node = this;
    RED.nodes.createNode(this, config);

    this.on('input', function (msg) {
      var message = '';

      message = checkPayload(node, msg, function(err, json) {
        if (err) {
          node.status({fill:'red', shape:'dot', text:err});
          node.error(err, msg);
          return;
        }
        node.status({fill:'blue', shape:'dot', text:'about to do something'});

        performConversion(json, function(err, csv) {
          if (err) {
            // Tried to get err into the status and error, but it refuses
            // to display properly.
            node.status({fill:'red', shape:'dot', text:'Error in conversion'});
            node.error('Error in Conversion', msg);
            return;
          }
          msg.payload = csv;
          node.status({});
          node.send(msg);
        });
      });

    });
  }

  RED.nodes.registerType('json-2-csv', Node, {
    credentials: {
      token: {type:'text'}
    }
  });
};
