const { Helpers }   = require('../../samcore/src/Helpers.js');
const editJsonFile  = require('edit-json-file');
const merge         = require('deepmerge');

class Model {
  constructor(localFile='localdb.json', remoteFile='remotedb.json') {
    this.localdb  = editJsonFile(`${process.cwd()}/${localFile}`, {autosave: true});
    this.remotedb = editJsonFile(`${process.cwd()}/${remoteFile}`, {autosave: true});
    this.username = null; // set from SamCore

    if ( !(Object.keys(this.localdb.get()).length) ) {
      this.localdb.set(`database`, {});
    } 

    // This is for the timestamp method. Makes sure that any new timestamp is
    // never the same as the previous.
    this.lastTimestamp = 0;
  }

  getSongs() {
    let idList = [];

    if ('songs' in this.remotedb.get('database')) {
      idList = idList.concat(Object.keys(
        this.remotedb.get(`database.songs`)
      ));
    }
    if ('songs' in this.localdb.get('database')) {
      idList = idList.concat(Object.keys(
        this.localdb.get(`database.songs`)
      ));
    }

    return idList;
  }

  getSong(songName) {
    let song = [];

    if ('songs' in this.remotedb.get('database') &&
        songName in this.remotedb.get('database.songs')) {
      song = song.concat(
        this.remotedb.get(`database.songs.${songName}`)
      );
    }
    if ('songs' in this.localdb.get('database') &&
        songName in this.localdb.get('database.songs')) {
      song = song.concat(
        this.localdb.get(`database.songs.${songName}`)
      );
    }

    return song.sort((a,b)=>b.timestamp-a.timestamp);
  }

  getSongAttr(songName, attr) {
    return this.getSong(songName)
      .filter(a => {
        return a.attr === attr;
      });
  }

  updateSong(songName, attr, value) {
    let update = {
      attr: attr,
      value: value,
      editedBy: this.username,
      timestamp: this._getTimestamp()
    }

    // if song already exists
    if ('songs' in this.localdb.get('database') &&
        songName in this.localdb.get('database.songs')) {

      this.localdb.append(`database.songs.${songName}`, update);
    }
    // if song doesnt exist
    else {
      if ( !('songs' in this.localdb.get('database')) ) {
        this.localdb.set('database.songs', {});
      }
      if ( !(songName in this.localdb.get('database.songs')) ) {
        this.localdb.set(`database.songs.${songName}`, [update]);
      }
    }
    return true;
  }

  getUploadList() {
    Object.entries(this.localdb.get('database')).forEach(([k1, v1]) => {
        if (k1 == 'songs') {
          Object.entries(v1).forEach(([songName, song]) => {
            song.forEach(entry => {
              if ('attr' in entry && entry.attr == 'mix') {
                Helpers.log({leader: 'arrow', loud: false}, 'mix: ', entry.value);
              }
            });
          });
        }
    });
  }


/*******************************************************************************/
  /**
    * @param {string} username - name of user updating record
    * @param {integer} id - id of record you want to change
    * @param {string} tableName - name of user updating record
    * @param {object} newValue - the key is the column to update
    */
  updateRecord(username, id, tableName, newValue) {
    if ( !(this._doesIdExist(tableName, id)) ) {
      Helpers.log({leader: 'error', loud: false}, 'ID does not exist');
      return -1; 
    }
    let keys = Object.keys(newValue);

    keys.forEach(key => {
      let updateRecord = { id: id };
      if ( newValue[key] === Object(newValue[key]) ) {
        let bKeys = Object.keys(newValue[key]);
        bKeys.forEach(bkey => { updateRecord[bkey] = newValue[key][bkey]; });
      } else {
        updateRecord[key] = newValue[key];
      }
      /* updateRecord[key]      = newValue[key]; */
      updateRecord.editedBy  = username;
      updateRecord.timestamp = this._getTimestamp();

      this.localdb.append(`database.${tableName}.${key}`, updateRecord);

    });

    return true; 
  }

  /**
    * Adds new record
    *
    * @param {string} username - name of user updating record
    * @param {string} tableName - name of user updating record
    * @param {object} newValue - the key is the column to update
    */
  newRecord(username, tableName, newValue) {
    let newId = this._getNextId(tableName);
    if (newId == -1) { newId = 0; }
    this.localdb.append(`database.${tableName}.id`, newId);
    this.updateRecord(username, newId, tableName, newValue);
    return true;
  }

  /**
    * Get desired record from database
    *
    * @param {string} tableName - Name of table
    * @param {integer} id - id of desired record
    * @param {array} columns
    *  array of strings of requested columns.  If 'all' is listed as the only
    *  option, will return all columns available.
    * @param {integer} numEntries
    *  num of history entries to return.  Can either be 0 or 'all' for all
    *  records, or specify a number of records to return.
    */
  getRecord(tableName, id, columns, numEntries=1) {
    let table = this.localdb.get(`database.${tableName}`);
    table = merge(table, this.remotedb.get(`database.${tableName}`));
    let result = {};

    let keys = [];
    if (columns[0] == 'all') {
      keys = Object.keys(table);
    } else {
      keys = columns;
    }

    keys.forEach(key => { if (key != 'id') {
      let entries = this._getNEntries(table[key], id, numEntries);
      if (entries !== undefined) { result[key] = entries; }
    }});

    return result;
  }

  /**
    * A little tricky here.  This gets a table with N number of entries per id.
    * In this database, each id will have multiple entires with different
    * timestamps to be able to provide backtracing/history.  We will be able to
    * record changes over time.  Because of this, the numEntries argument is the
    * number of changes per id you would like included in the request.
    *
    * @param {string} tableName - Name of table
    * @param {array} columns
    *  array of strings of requested columns.  If 'all' is listed as the only
    *  option, will return all columns available.
    * @param {integer} numEntries
    *  num of history entries to return.  Can either be 0 or 'all' for all
    *  records, or specify a number of records to return.
    */
  getTable(tableName, columns, numEntries=1) {
    let idList = this._getIdList(tableName);
    if (idList == -1) { return -1; }

    let result = [];

    idList.forEach(id => {
      let record = this.getRecord(tableName, id, columns, numEntries);
      if (Object.keys(record).length != 0) { result.push(record); }
      // Helpers.log({leader: 'arrow', loud: false}, 'record: ', record);
    });

    return result;
  }

  /**
    * This function runs through the temp json and cloud json files, compares
    * them, and then compiles a list of commands that need to be run by gdrive
    * node to be able to merge the two json files together.
    *
    * @return {array} - list of commands for gdrive node to process
    *
    */
  getUploadCommands() {
    let ldb      = this.localdb.get('database');
    let rdb      = this.remotedb.get('database');
    let commands = [];

    if ('songs' in Object.keys(ldb)) {

      if ('id' in Object.keys(ldb.songs)) {
        // check if keys exist in remote json file yet
        if ('songs' in Object.keys(rdb) && 'id' in Object.keys(rdb.songs)) {
          // if the keys do exist in remote json file, compare the two json files
          ldb.songs.id.forEach(n => {
            if ( !(n in rdb.songs.id) ) { // if id does not exist in remote
              commands.push({/* add song id to list */});
            }
          });
        } else {
          ldb.songs.id.forEach(n => {
            commands.push({/* add all song id's to list */});
          });
        }
      }

      if ('name' in Object.keys(ldb.songs)) {
        if ('songs' in Object.keys(rdb) && 'name' in Object.keys(rdb.songs)) {
          ldb.songs.name.forEach(n => {
            rdb.songs.name.forEach(a => {
              if ( !(n.id == a.id && n.name == a.name && n.editedBy == a.editedBy) ) {
                commands.push({/* add song-name to list */});
              }
            });
          });
        } else {
          ldb.songs.name.forEach(n => {
            commands.push({/* add song-name to list */});
          });
        }
      }
    }
  }

  /**
    * get all columns for record with 'id'.
    *
    * @param {string} entryList - array of records
    * @param {integer} id - id of desired record
    * @param {integer} numEntries
    *  num of history entries to return.  Can either be 0 or 'all' for all
    *  records, or specify a number of records to return.
    */
  _getNEntries(entryList, id, numEntries=1) {
    let filteredList = entryList.filter(a => {
      return a.id === id;
    });

    filteredList.sort((a,b)=>b.timestamp-a.timestamp);

    if (numEntries == 'all' || numEntries == 0) {
      return filteredList;
    } else if (numEntries == 1) {
      return filteredList[0];
    } else if (filteredList.length >= numEntries) {
      return filteredList.slice(0, numEntries);
    } else {
      Helpers.log({leader: 'error', loud: false}, 'Model._getNEntries: Num Entries were incorrect.');
      return -1;
    }
  }

  /**
    * Checks to see if ID actually exists
    *
    * @param {string} tableName - name of table to check
    * @param {integer} id - id to check
    */
  _doesIdExist(tableName, id) {
    let idList = this._getIdList(tableName);
    Helpers.log({leader: 'arrow', loud: false}, 'idList: ', idList);
    if (idList == -1) { return false; }
    return idList.includes(id);
  }

  /**
    * Gets next new id for specific table.
    * References remotedb table.
    *
    * TODO: Need a catch if it creates an ID that was uploaded already.
    *
    * @param {string} tableName - name of table to check
    */
  _getNextId(tableName) {
    let idList = this._getIdList(tableName);
    if (idList == -1) { return -1; }
    return idList[0]+1;
  }

  _getIdList(tableName) {
    let idList = [];

    if ( !(tableName in Object.keys(this.remotedb.get('database'))) ) {
      idList = idList.concat(this.remotedb.get(`database.${tableName}.id`));
    }
    if ( !(tableName in Object.keys(this.localdb.get('database'))) ) {
      idList = idList.concat(this.localdb.get(`database.${tableName}.id`));
    }

    if (idList.length == 0) { return -1; }

    return idList.sort((a,b)=>b-a);
  }

  /**
    * Gets latest timestamp in ms
    */
  _getTimestamp() {
    let timestamp = Date.now();
    if (timestamp == this.lastTimestamp) { timestamp += 1; }
    this.lastTimestamp = timestamp;
    return timestamp;
  }
  // _getTimestamp() { return Date.now(); }
}

module.exports = { Model };
