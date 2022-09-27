const { Model }   = require('./model.js');
const { Client }  = require('../../samcore/src/Client.js');
const { Helpers } = require('../../samcore/src/Helpers.js');

let db         = new Model('localdb.json', 'remotedb.json');
let nodeName   = 'dbjson';
let serverName = 'samcore';
let node       = new Client(nodeName, serverName);

node
  /**
    * Returns all songs in the system.
    *
    * No arguments are required.
    */
  .addApiCall('getSongs', function(packet) {
    packet.data = db.getSongs();
    this.return(packet);
  })

  /**
  * get all data associated with a song
  *
  * packet.data requires the name of the song.
  */
  .addApiCall('getSong', function(packet) {
    packet.bdata = packet.data;
    packet.data  = db.getSong(packet.data);
    this.return(packet);
  })


  /**
    * Used for updating an attribute of a song.
    * packet.data requires an object with the following vars:
    *   name:  name of song
    *   attr:  attribute you want to add
    *   value: value of the attribute
    */
  .addApiCall('updateSong', function(packet) {
    let result = updateSong(packet.data);

    if ('errorMessage' in result) {
      this.returnError(packet, result.errorMessage);
    }

    packet.bdata = packet.data;
    packet.data  = result.data;
    this.return(packet);
  })

  /**
    * Used for adding multiple attributes to the database at once
    *
    * packet.data requires an array of objects:
    *    {name:  name of song
    *     attr:  attribute you want to add
    *     value: value of the attribute }
    */
  .addApiCall('bulkupdate', function(packet) {
    for (let i = 0; i < packet.data.length; i++) {
      const song = packet.data[i];
      let res = updateSong(song);

      if ('errorMessage' in res) {
        this.returnError(packet, result.errorMessage);
        return;
      }
    }

    packet.bdata = packet.data;
    packet.data  = true;
    this.return(packet);
  })

  /**
    * Under Construction
    *
    * Used for pushing local changes to the cloud.
    */
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

  .run({
    onInit:    onInit,
    onConnect: onConnect
  });

/**
  * Before we can start running the node, we need to get the username
  * and settings
  */
async function onInit() {
  let packet  = await this.callApi(serverName, 'getUsername');
  db.username = packet.data;

  packet      = await this.callApi(serverName, 'getSettings');
  db.settings = packet.data;
}

/**
  * Any code that needs to run when the node starts
  */
async function onConnect() {}


/**
  * Used for adding data to a song.
  *
  * @param {object} data
  *   Requires:
  *     name:  name of song
  *     attr:  attribute you want to add
  *     value: value of the attribute
  *
  * @return {object}
  *   Returns an object with either {data: true} or {errorMessage: 'message'}
  */
function updateSong(data) {
  // error handling
  if ( !('name' in data) ) {
    return { errorMessage: 'Song name not included!' }
  }
  if ( !('attr' in data) ) {
    return { errorMessage: 'Attribute not included!' }
  }
  if ( !('value' in data) ) {
    return { errorMessage: 'Value not included!' }
  }

  return {
    data: db.updateSong(data.name, data.attr, data.value)
  };
}
