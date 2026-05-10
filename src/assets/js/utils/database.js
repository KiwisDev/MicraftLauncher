/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
const Database = require('better-sqlite3');
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

let dev = process.env.NODE_ENV === 'dev';

class database {
    constructor() {
        this._dbs = {};
    }

    _getDbPath(tableName) {
        const userDataPath = ipcRenderer.sendSync('path-user-data-sync');
        const dbDir = path.join(userDataPath, '')
        console.log(dbDir);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

        return path.join(dbDir, `${tableName}.db`);
    }

    _getDb(tableName) {
        if (this._dbs[tableName]) return this._dbs[tableName];

        const dbPath = this._getDbPath(tableName);
        const db = new Database(dbPath);

        db.exec(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                json_data TEXT NOT NULL
            )
        `);

        this._dbs[tableName] = db;
        return db;
    }

    createData(tableName, data) {
        const db = this._getDb(tableName);
        const stmt = db.prepare(`INSERT INTO ${tableName} (json_data) VALUES (?)`);
        const result = stmt.run(JSON.stringify(data));
        return { ...data, ID: result.lastInsertRowid };
    }

    readData(tableName, key = 1) {
        const db = this._getDb(tableName);
        const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(key);
        if (!row) return undefined;
        return { ...JSON.parse(row.json_data), ID: row.id };
    }

    readAllData(tableName) {
        const db = this._getDb(tableName);
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
        return rows.map(row => ({ ...JSON.parse(row.json_data), ID: row.id }));
    }

    updateData(tableName, data, key = 1) {
        const db = this._getDb(tableName);
        db.prepare(`UPDATE ${tableName} SET json_data = ? WHERE id = ?`)
          .run(JSON.stringify(data), key);
    }

    deleteData(tableName, key = 1) {
        const db = this._getDb(tableName);
        db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(key);
    }

    closeAll() {
        for (const db of Object.values(this._dbs)) db.close();
        this._dbs = {};
    }
}

export default database;
