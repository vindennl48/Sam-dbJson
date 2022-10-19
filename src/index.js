const { Model }   = require('./model.js');
const { Client }  = require('../../samcore/src/Client.js');
const { Helpers } = require('../../samcore/src/Helpers.js');
const Packet      = Helpers.Packet;

let db         = new Model('localdb.json', 'remotedb.json');
let nodeName   = 'dbjson';
let serverName = 'samcore';
let node       = new Client(nodeName, serverName);

node
  /**
  * packet.args = {
  *   type: object type, either 'song', 'songs', 'mixer', 'mixers'
  *   name: 'name of song or mix' (optional)
  * }
  */
  .addApiCall('get', function(packet) {
    if (!Packet.checkArgs(this, ['type'], packet)) return;
    let type = packet.args.type;

    if ( ['song','mixer'].includes(type) ) {
      if (!Packet.checkArgs(this, ['name'], packet)) return;
      let name = packet.args.name;

      packet = Packet.mergeMini(packet, db.getItem(`${type}s`, name));
    } else {
      packet = Packet.mergeMini(packet, db.getIndex(type));
    }

    this.return(packet);
  })

  /**
  * packet.args = {
  *   type:  object type, either 'song', 'mixer',
  *   name:  'name of song or mix',
  *   attr:  'attribute name to add to',
  *   ifNew: boolean if you only want to add if the value doesnt already exist
  *   value: { either string/int/bool or object with all the values you want
  *            to add },
  * }
  */
  .addApiCall('set', function(packet) {
    if (!Packet.checkArgs(this, ['type', 'name', 'attr', 'value'], packet)) return;
    let type  = packet.args.type;
    let name  = packet.args.name;
    let attr  = packet.args.attr;
    let value = packet.args.value;
    let ifNew = packet.args.ifNew || false;
    let path  = [`${type}s`, name, attr];

    if (ifNew) {
      let ans = db.getIndex(path);
      if (!ans) { ifNew = false; } // failsafe
      ans = ans.result;

      if ( ans.find(item => item.value === value) === undefined ) {
        ifNew = false; // if we can not find it, then lets add it!
      }
    }

    if (!ifNew) {
      packet = Packet.mergeMini(packet, db.addAttribute(path, value));
    }

    this.return(packet);
  })

  /**
    * Used for creating a new song or mix
    *
    * packet.args = {
    *   type: object type, either 'song', 'mixer'
    *   name: 'name of song',
    * }
    *
    */
  .addApiCall('new', function(packet) {
    if (!Packet.checkArgs(this, ['type', 'name'], packet)) return;
    let type = packet.args.type;
    let name = packet.args.name;
    let path = [`${type}s`, name];

    let ans = db.getItem(path);

    if (Object.keys(ans.result).length !== 0) {
      this.returnError(packet, `${type} already exists!`);
      return;
    }

    // To add a song, we can just add a 'name' attribute to a new song.  This
    // gives us data on who created the song and when.
    path.push('name');
    db.addAttribute(path, name);

    // packet.data = { status: true }; // Client.js auto adds this for return()
    this.return(packet);
  })

  /**
    * Used for duplicating a song or mix
    *
    * packet.args = {
    *   type:    object type, either 'song', 'mixer'
    *   name:    'name of song or mix to duplicate',
    *   newName: 'new song or mix name',
    * }
    *
    */
  .addApiCall('duplicate', function(packet) {
    if (!Packet.checkArgs(this, ['type', 'name', 'newName'], packet)) return;

    let type    = packet.args.type;
    let name    = packet.args.name;
    let newName = packet.args.newName;
    let ans     = db.getItem([`${type}s`, name]);

    if (Object.keys(ans.result).length === 0) {
      this.returnError(packet, 'Song does not exist!');
      return;
    }

    let path = [`${type}s`, newName];

    // Add entire branch to new song
    db.localdb.set(path, ans.result);

    path.push('name');

    // Redo the first creation to set first upload as current user
    db.localdb.unset(path);
    db.addAttribute(path, newName);

    // packet.data = { status: true }; // Client.js auto adds this for return()
    this.return(packet);
  })

  /**
    * Used for removing local songs and mixes. Can only remove local non-pushed
    * items.
    *
    * packet.args = {
    *   type:            object type, either 'song', 'mixer',
    *   name:            'name of song or mix',
    *   attr (optional): 'if you want to remove a specific attribute of a song
    *                    or mix'
    * }
    *
    */
  .addApiCall('remove', function(packet) {
    if (!Packet.checkArgs(this, ['type', 'name'], packet)) return;
    let type = packet.args.type;
    let name = packet.args.name;
    let path = [`${type}s`, name];

    if ('attr' in packet.args) {
      path.push(packet.args.attr);
    }

    packet = Packet.mergeMini(packet, db.delete(path));
    
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
  if (packet.status) {
    db.username = packet.result;
  } else {
    Helpers.log({leader: 'error', loud: false},
      'Error: ',
      packet.errorMessage
    );
  }

  // Load settings from samcore
  packet = await this.callApi(serverName, 'getSettings');
  if (packet.status) {
    db.settings = packet.result;
  } else {
    Helpers.log({leader: 'error', loud: false},
      'Error: ',
      packet.errorMessage
    );
  }
}

/**
  * Any code that needs to run when the node starts
  */
async function onConnect() {
  Helpers.log({leader: 'arrow', loud: true}, 'Running!');
}


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
    result: db.updateSong(data.name, data.attr, data.value)
  };
}
