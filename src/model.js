const merge            = require('deepmerge');
const { Helpers }      = require('../../samcore/src/Helpers.js');
const { EditJsonFile } = require('../../samcore/src/EditJsonFile.js');

// Example database:
// {
//   'database': {
//     'songs': {
//       'Petrichor': {
//         'tags': [
//           {'value': 'bass', 'editedBy': 'mitch', 'timestamp': 1230192343725},
//           {'value': 'strings', 'editedBy': 'mitch', 'timestamp': 1230192343725}
//         ]
//       }
//     }
//   }
// }

class Model {
  constructor(localFile='localdb.json', remoteFile='remotedb.json') {
    this.localdb  = new EditJsonFile(`${process.cwd()}/${localFile}`, {autosave: true});
    this.remotedb = new EditJsonFile(`${process.cwd()}/${remoteFile}`, {autosave: true});

    if ( !(Object.keys(this.localdb.get()).length) ) {
      this.localdb.set(`database`, {});
    } 
    if ( !(Object.keys(this.remotedb.get()).length) ) {
      this.remotedb.set(`database`, {});
    } 

    this.username = 'default';
    this.settings = {};

    // This is for the timestamp method. Makes sure that any new timestamp is
    // never the same as the previous.
    this.lastTimestamp = 0;
  }

  /**
    * Add attribute to object in dbjson.
    *
    * @param {string|array} path
    *   Path to get to desired data object in dbjson
    * @param {any} value
    *   Value of attribute. Can be anything.
    */
  addAttribute(path, value) {
    if (this.username === 'default') {
      return {
        status: false,
        errorMessage: 'Username is not set!'
      }
    }

    if (typeof path === 'string') {
      path = path.split('.');
    }
    if (path[0] !== 'database') {
      path.unshift('database');
    }

    if (this.localdb.get(path) === 'undefined') {
      this.localdb.set(path, []);
    }

    this.localdb.append(
      path,
      {
        value:     value,
        editedBy:  this.username,
        timestamp: this._timestamp(),
      }
    );

    return { status: true };
  }

  /**
    * Get all attributes from an item
    *
    * @param {string|array} path
    *   Path to get to desired data object in dbjson
    *
    * @return {object} Return object
    */
  getItem(path) {
    if (this.username === 'default') {
      return {
        status: false,
        errorMessage: 'Username is not set!'
      }
    }

    if (typeof path === 'string') {
      path = path.split('.');
    }
    if (path[0] !== 'database') {
      path.unshift('database');
    }

    let result = {};

    let ans = this.localdb.get(path);
    if (ans !== undefined && typeof ans === 'object') {
      result = merge(result, ans);
    }

    ans = this.remotedb.get(path);
    if (ans !== undefined && typeof ans === 'object') {
      result = merge(result, ans);
    }

    return {
      status: true,
      result: result
    }
  }

  /**
    * Get all keys under an object in dbjson.
    *
    * @param {string|array} path
    *   Path to get to desired data object in dbjson
    *
    * @return {object} Return object
    */
  getIndex(path) {
    if (this.username === 'default') {
      return {
        status: false,
        errorMessage: 'Username is not set!'
      }
    }

    if (typeof path === 'string') {
      path = path.split('.');
    }
    if (path[0] !== 'database') {
      path.unshift('database');
    }

    let result = [];

    let ans = this.localdb.get(path);
    if (ans !== undefined && typeof ans === 'object') {
      result = result.concat( Object.keys(ans) );
    }

    ans = this.remotedb.get(path);
    if (ans !== undefined && typeof ans === 'object') {
      result = result.concat( Object.keys(ans) );
    }

    return {
      status: true,
      result: result
    }
  }

  /**
    * Delete object or item. Only can be used on localdb before upload.
    *
    * @param {string|array} path
    *   Path to get to desired data object in dbjson
    */
  delete(path) {
    if (this.username === 'default') {
      return {
        status: false,
        errorMessage: 'Username is not set!'
      }
    }

    if (typeof path === 'string') {
      path = path.split('.');
    }
    if (path[0] !== 'database') {
      path.unshift('database');
    }
    this.localdb.unset(path);

    return { status: true };
  }

  /**
    * Under Construction
    *
    * This function runs through the temp json and cloud json files, compares
    * them, and then compiles a list of commands that need to be run by gdrive
    * node to be able to merge the two json files together.
    *
    * @return {array} - list of commands for gdrive node to process
    */
  getUploadList() {
    if (this.username === 'default') {
      return {
        status: false,
        errorMessage: 'Username is not set!'
      }
    }

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

  /**
    * Gets latest timestamp in ms
    */
  _timestamp() {
    let timestamp = Date.now();
    if (timestamp == this.lastTimestamp) { timestamp += 1; }
    this.lastTimestamp = timestamp;
    return timestamp;
  }
}

module.exports = { Model };
