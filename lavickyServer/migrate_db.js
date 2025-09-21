const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('users.db');

// Create tables if they don't exist
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        Username TEXT UNIQUE NOT NULL,
        Password TEXT NOT NULL
    )`);

    // Drop and recreate Sessions table to add Expires column
    db.run(`DROP TABLE IF EXISTS Sessions`);
    db.run(`CREATE TABLE Sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        SessionId TEXT UNIQUE NOT NULL,
        User TEXT NOT NULL,
        Expires TEXT NOT NULL
    )`);

    // Check if Lavicky table exists and add columns if needed
    db.all(`PRAGMA table_info(Lavicky)`, (err, columns) => {
        if (err) {
            console.log('Creating Lavicky table...');
            db.run(`CREATE TABLE Lavicky (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                Lat REAL NOT NULL,
                Lng REAL NOT NULL,
                CreatedBy TEXT,
                PhotoPath TEXT,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error('Error creating table:', err);
                else console.log('Lavicky table created');
                db.close();
            });
        } else {
            console.log('Lavicky table exists, checking columns...');
            // Check if columns exist and add them if they don't
            const columnNames = columns.map(col => col.name);
            console.log('Existing columns:', columnNames);
            
            let columnsToAdd = [];
            if (!columnNames.includes('CreatedBy')) {
                columnsToAdd.push('CreatedBy TEXT');
            }
            if (!columnNames.includes('PhotoPath')) {
                columnsToAdd.push('PhotoPath TEXT');
            }
            if (!columnNames.includes('CreatedAt')) {
                columnsToAdd.push('CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP');
            }
            
            if (columnsToAdd.length > 0) {
                console.log('Adding columns:', columnsToAdd);
                // Add all columns in one operation
                const alterSQL = `ALTER TABLE Lavicky ADD COLUMN ${columnsToAdd.join(', ADD COLUMN ')}`;
                db.run(alterSQL, (err) => {
                    if (err) {
                        console.error('Error adding columns:', err);
                        // Try adding them one by one
                        addColumnsOneByOne();
                    } else {
                        console.log('All columns added successfully');
                        db.close();
                    }
                });
            } else {
                console.log('All required columns already exist');
                db.close();
            }
        }
    });
    
    function addColumnsOneByOne() {
        const columnsToAdd = [];
        if (!columnNames.includes('CreatedBy')) {
            columnsToAdd.push('CreatedBy TEXT');
        }
        if (!columnNames.includes('PhotoPath')) {
            columnsToAdd.push('PhotoPath TEXT');
        }
        if (!columnNames.includes('CreatedAt')) {
            columnsToAdd.push('CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP');
        }
        
        let index = 0;
        function addNextColumn() {
            if (index >= columnsToAdd.length) {
                console.log('All columns added successfully');
                db.close();
                return;
            }
            
            const sql = `ALTER TABLE Lavicky ADD COLUMN ${columnsToAdd[index]}`;
            console.log('Adding column:', columnsToAdd[index]);
            db.run(sql, (err) => {
                if (err) {
                    console.error('Error adding column:', columnsToAdd[index], err);
                } else {
                    console.log('Column added:', columnsToAdd[index]);
                }
                index++;
                addNextColumn();
            });
        }
        addNextColumn();
    }
});

db.close();
