// utils/storage.js
const fs = require('fs');

class FileStorage {
    constructor(filePath) {
        this._path = filePath;
    }

    load() {
        try {
            if (!fs.existsSync(this._path)) return null;
            const raw = fs.readFileSync(this._path, 'utf8');
            return JSON.parse(raw);
        } catch (err) {
            console.error(`[Storage] Failed to load ${this._path}:`, err);
            return null;
        }
    }

    save(data) {
        try {
            fs.writeFileSync(this._path, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            console.error(`[Storage] Failed to save ${this._path}:`, err);
        }
    }
}

class InMemoryStorage {
    constructor(initialData = null) {
        this._data = initialData;
    }

    load() {
        return this._data;
    }

    save(data) {
        this._data = data;
    }
}

module.exports = { FileStorage, InMemoryStorage };
