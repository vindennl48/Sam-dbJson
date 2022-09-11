const { Helpers }  = require('../../samcore/src/Helpers.js');
const editJsonFile = require('edit-json-file');
const {callbackify} = require('util');

class Model {
  constructor(fileName='databaseFile.json') {
    const runDirectory = process.cwd();
    const databaseFile = fileName;
    const filePath     = `${runDirectory}/${databaseFile}`
    this.file          = editJsonFile(filePath, {autosave: true});

    if (!Object.keys(this.file.get()).length) {
      this.file.set(`database.songs.name`, [
        { id: 0, name: 'Sono', editedBy: 'mitch', timestamp: 0 }
      ]);
    } 

    // This is for the timestamp method. Makes sure that any new timestamp is
    // never the same as the previous.
    this.lastTimestamp = 0;
  }

  /**
    * @param {string} username - name of user updating record
    * @param {integer} id - id of record you want to change
    * @param {string} tableName - name of user updating record
    * @param {object} newValue - the key is the column to update
    */
  updateRecord(username, id, tableName, newValue) {
    if (!this._doesIdExist(tableName, id)) {
      Helpers.log({leader: 'error', loud: false}, 'ID does not exist');
      return false; 
    }
    let keys = Object.keys(newValue);

    keys.forEach(key => {
      let updateRecord       = { id: id };
      if ( newValue[key] === Object(newValue[key]) ) {
        let bKeys = Object.keys(newValue[key]);
        bKeys.forEach(bkey => { updateRecord[bkey] = newValue[key][bkey]; });
      } else {
        updateRecord[key] = newValue[key];
      }
      /* updateRecord[key]      = newValue[key]; */
      updateRecord.editedBy  = username;
      updateRecord.timestamp = this._getTimestamp();

      this.file.append(`database.${tableName}.${key}`, updateRecord);

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
    this.file.append(`database.${tableName}.id`, newId);
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
    let table = this.file.get(`database.${tableName}`);
    let result = {};

    let keys = [];
    if (columns[0] == 'all') {
      keys = Object.keys(table);
    } else {
      keys = columns;
    }

    keys.forEach(key => { if (key != 'id') {
      let entries = this._getNEntries(table[key], id, numEntries);
      // Helpers.log({leader: 'arrow', loud: false}, 'entries: ', entries);
      if (entries !== undefined) { result[key] = entries; }
    }});

    return result;
  }

  getTable(tableName, columns, numEntries=1) {
    let idList = this.file.get(`database.${tableName}.id`);
    let result = [];

    idList.forEach(id => {
      let record = this.getRecord(tableName, id, columns, numEntries);
      if (Object.keys(record).length != 0) { result.push(record); }
      // Helpers.log({leader: 'arrow', loud: false}, 'record: ', record);
    });

    return result;
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
      return false;
    }
  }

  /**
    * Checks to see if ID actually exists
    *
    * @param {string} tableName - name of table to check
    * @param {integer} id - id to check
    */
  _doesIdExist(tableName, id) {
    return this.file.get(`database.${tableName}.id`).includes(id);
  }

  /**
    * Gets next new id for specific table
    *
    * @param {string} tableName - name of table to check
    */
  _getNextId(tableName) {
    let idList = this.file.get(`database.${tableName}.id`).sort((a,b)=>b-a);
    return idList[0]+1;
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
