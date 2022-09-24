const { Model }   = require('./model.js');
const { Client }  = require('../../samcore/src/Client.js');
const { Helpers } = require('../../samcore/src/Helpers.js');

let db         = new Model('localdb.json', 'remotedb.json');
let nodeName   = 'dbjson';
let serverName = 'samcore';
let node       = new Client(nodeName, serverName/*, false*/);

node
  /**
  * Returns all songs in the system
  */
  .addApiCall('getSongs', function(packet) {
    packet.data = db.getSongs();
    this.return(packet);
  })

  /**
  * get all data associated with a song
  */
  .addApiCall('getSong', function(packet) {
    packet.bdata = packet.data;
    packet.data  = db.getSong(packet.data);
    this.return(packet);
  })

  .addApiCall('updateSong', function(packet) {
    // error handling
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'Song name not included!');
      return;
    }
    if ( !('attr' in packet.data) ) {
      this.returnError(packet, 'Attribute not included!');
      return;
    }
    if ( !('value' in packet.data) ) {
      this.returnError(packet, 'Value not included!');
      return;
    }

    packet.bdata = packet.data;
    packet.data  = db.updateSong(packet.data.name, packet.data.attr, packet.data.value);
    this.return(packet);
  })

  .addApiCall('pushToRemote', function(packet) {
    db.getUploadList();
    /* This is used to push changes from localdb to remotedb. This involves
       uploading any audio/project files */

    // Check if we have internet connection
    // If no, then stop function

    // filter thru items in localdb.

    // If item is an audio file, check if mix is already uploaded, if not, upload

    /* If item is a project file, place existing project into storage, upload
         updated project file in it's place. */

    // Merge localdb entry into remotedb
  })

  /**
  * Default error message handler
  */
  .addApiCall('onError', function(packet) {
    // in GUI's, we can have this as a banner thing to show all errors
    // in CLI, might need to add a 'kill program' thing in here
    Helpers.log({leader: 'error', loud: false}, 'Error Packet: ', packet);
    Helpers.log({leader: 'error', loud: false}, 'Error Message: ', packet.errorMessage);
  })

  .run(onInit=function(callback){
    callback();
  }, onConnect=function() {
    this.callApi(serverName, 'getUsername', {}, function(packet) {
      if (packet.data == 0) {
        Helpers.log({leader: 'error', loud: false}, 'Username does not exist!');
      }
      db.username = packet.data;

      this.callApi(nodeName, 'pushToRemote');
    });
  });
