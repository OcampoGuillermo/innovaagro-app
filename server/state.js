'use strict';

let database = null;

function setDb(value) { database = value; }
function getDb() {
  if (!database) throw new Error('La base de datos todavía no fue inicializada.');
  return database;
}

module.exports = { setDb, getDb };
