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
    packet.data = db.getIndex('songs');
    this.return(packet);
  })

  /**
  * get all data associated with a song
  *
  * packet.data = { name: 'name of song' }
  */
  .addApiCall('getSong', function(packet) {
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'Song name not in packet!');
      return;
    }

    let path    = ['songs', packet.data.name];
    packet.data = db.getItem(path);

    this.return(packet);
  })

  /**
    * Used for updating an attribute of a song.
    *
    * packet.data = {
    *   name:  'name of song',
    *   attr:  'attribute name',
    *   value: 'value of attribute, can be any data type',
    * }
    */
  .addApiCall('updateSong', function(packet) {
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'Song name not included!');
      return;
    }
    if ( !('attr' in packet.data) ) {
      this.returnError(packet, 'Attribute name not included!');
      return;
    }
    if ( !('value' in packet.data) ) {
      this.returnError(packet, 'Value name not included!');
      return;
    }

    let path    = ['songs', packet.data.name, packet.data.attr];
    packet.data = db.addAttribute(path, packet.data.value);

    this.return(packet);
  })

  /**
    * Used for creating a new song
    *
    * packet.data = {
    *   name: 'name of song',
    * }
    *
    * Returns 'result' as path to local song file
    */
  .addApiCall('newSong', function(packet) {
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'Song name not included!');
      return;
    }

    let path = ['songs', packet.data.name];
    let ans  = db.getItem(path);

    if (Object.keys(ans.result).length !== 0) {
      this.returnError(packet, 'Song already exists!');
      return;
    }

    // To add a song, we can just add a 'name' attribute to a new song.  This
    // gives us data on who created the song and when.
    path.push('name');
    db.addAttribute(path, packet.data.name);

    packet.data = { status: true };
    this.return(packet);
  })

//  /**
//    * Used for adding multiple attributes to the database at once
//    *
//    * packet.data requires an array of objects:
//    *    {name:  name of song
//    *     attr:  attribute you want to add
//    *     value: value of the attribute }
//    */
//  .addApiCall('bulkupdate', function(packet) {
//    for (let i = 0; i < packet.data.length; i++) {
//      const song = packet.data[i];
//      let res = updateSong(song);
//
//      if ('errorMessage' in res) {
//        this.returnError(packet, result.errorMessage);
//        return;
//      }
//    }
//
//    packet.data = true;
//    this.return(packet);
//  })

//  /**
//    * Under Construction
//    *
//    * Used for pushing local changes to the cloud.
//    */
//  .addApiCall('pushToRemote', function(packet) {
//    db.getUploadList();
//    /* This is used to push changes from localdb to remotedb. This involves
//       uploading any audio/project files */
//
//    // Check if we have internet connection
//    // If no, then stop function
//
//    // filter thru items in localdb.
//
//    // If item is an audio file, check if mix is already uploaded, if not, upload
//
//    /* If item is a project file, place existing project into storage, upload
//         updated project file in it's place. */
//
//    // Merge localdb entry into remotedb
//  })

  .run({
    onInit:    onInit,
    onConnect: onConnect
  });

/**
  * Before we can start running the node, we need to get the username
  * and settings
  */
async function onInit() {
  // load username from samcore
  let packet = await this.callApi(serverName, 'getUsername');
  if (packet.data.status) {
    db.username = packet.data.result;
  } else {
    Helpers.log({leader: 'error', loud: false},
      'Error: ',
      packet.data.errorMessage
    );
  }

  // Load settings from samcore
  packet = await this.callApi(serverName, 'getSettings');
  if (packet.data.status) {
    db.settings = packet.data.result;
  } else {
    Helpers.log({leader: 'error', loud: false},
      'Error: ',
      packet.data.errorMessage
    );
  }
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
