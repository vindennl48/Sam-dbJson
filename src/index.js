const { Model }    = require('./model.js');
const { Client }   = require('../../samcore/src/Client.js');
const { Helpers }  = require('../../samcore/src/Helpers.js');

let db         = new Model('localdb.json', 'remotedb.json');
let nodeName   = 'dbjson';
let serverName = 'samcore';
let node       = new Client(nodeName, serverName/*, false*/);

node
  /**
    * Returns all songs in the system
    */
  .addApiCall('getSongList', function(packet) {
    packet.data = db.getTable('songs', ['name']);
    this.return(packet);
  })
  /**
    * get all data associated with a song
    */
  .addApiCall('getSongData', function(packet) {
    packet.bdata = packet.data; // make a backup of the call

    if (!('numEntries' in packet.data)) { packet.data.numEntries = 1; }

    packet.data = db.getRecord(
      'songs',
      packet.data.id,
      packet.data.columns,
      packet.data.numEntries
    );

    this.return(packet);
  })
  /**
    * get a list of all scratch tracks available
    */
  .addApiCall('getScratchTracks', function(packet) {
    packet.data = db.getTable('songs', ['scratch']);
    this.return(packet);
  })
  .addApiCall('newSong', function(packet) {
    packet.bdata = packet.data;
    if (db.newRecord(packet.data.username, 'songs', { name: packet.data.name } )) {
      packet.data = true;
      this.return(packet);
      return;
    }
    packet.data = false;
    this.return(packet);
  })


  // Testing our API calls
  .addReturnCall(nodeName, 'getSongList', function(packet) {
    packet.data.forEach(song => {
      Helpers.log({leader: 'arrow', loud: false},
        'id: ', song.name.id, ', name: ', song.name.name,
        ', object: ', song
      );
    });
  })
  .addReturnCall(nodeName, 'getSongData', function(packet) {
    Helpers.log({leader: 'arrow', loud: false}, 'Song Data: ', packet.data);
  })
  .addReturnCall(nodeName, 'getScratchTracks', function(packet) {
    Helpers.log({leader: 'arrow', loud: false}, 'Song Data: ', packet.data);
  })
  .addReturnCall(nodeName, 'newSong', function(packet) {
    Helpers.log({leader: 'arrow', loud: false},
      `New song '${packet.bdata.name}' successful?: `,
      packet.data
    );
  })

  .run(function() {
    // API tests:
    // this.callApi(nodeName, 'getSongList');
    // this.callApi(nodeName, 'getSongData', { id: 1, columns: ['all'], numEntries: 'all' });
    // this.callApi(nodeName, 'getScratchTracks');
    // this.callApi(nodeName, 'newSong', { name: 'BigSkyBlue', username: 'mitch' });
  });
