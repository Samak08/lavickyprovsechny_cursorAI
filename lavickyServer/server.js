const http = require("http");
const fs = require("fs");
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const db = new sqlite3.Database('users.db');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/bench_photos/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'bench-' + uniqueSuffix + '.jpg');
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Input validation and sanitization functions
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[<>'"&]/g, function(match) {
        const escape = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
        };
        return escape[match];
    });
}

function validateLatLng(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    return !isNaN(latNum) && !isNaN(lngNum) && 
           latNum >= -90 && latNum <= 90 && 
           lngNum >= -180 && lngNum <= 180;
}

function validateUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

db.each(`select * from Users`, (err, rows) => {
    if (err){
        console.error(err.message);
    }
    else{
        console.log(rows);
    }
});

async function checkPassword(password, hashedPassword){
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
}
async function hashPassword(password){
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

function parseCookies(req){
    const cookieHeader = req.headers.cookie;
    if(!cookieHeader){
        return {};
    }
    else{
        const cookies = {};
        cookieHeader.split("; ").forEach(cookie => {
            const [name, value] = cookie.split("=");
            cookies [name] = value;
        });
        return cookies
    }
}

function createSession(userName, res){
    const newSessionId = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    console.log(newSessionId);
    db.run(`insert into Sessions (SessionId, User, Expires) values (?, ?, ?)`, [newSessionId, userName, expires.toISOString()], err => {
        if(err){
            res.writeHead(500);
            res.end("Internal server error");
        }
        else{
            res.writeHead(302, {
                "Set-Cookie": `sessionId=${newSessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
                "Location": '/',
                "Content-Type": "text/plain"
            });
            res.end();                            
        }
    });
}

function validateSession(sessionId, callback) {
    if (!sessionId || typeof sessionId !== 'string') {
        return callback(false);
    }
    
    db.get(`SELECT * FROM Sessions WHERE SessionId = ? AND Expires > datetime('now')`, [sessionId], (err, row) => {
        if (err || !row) {
            return callback(false);
        }
        callback(true, row.User);
    });
}


const server = http.createServer((req, res) => {
    console.log(req.url);

    const cookies = parseCookies(req);
    const sessionId = cookies.sessionId;
    console.log(sessionId);

    if (req.url === "/"){
        if(sessionId){
            validateSession(sessionId, (isValid, user) => {
                if (isValid) {
                    fs.readFile("static/index2.html", (err, data) => {
                        if (err){
                            res.writeHead(500, {"Content-Type": "text/plain"});
                            res.end("Internal server error");
                        }
                        else{
                            res.end(data);
                        }
                    });
                } else {
                    fs.readFile("static/index.html", (err, data) => {
                        if (err){
                            res.writeHead(500, {"Content-Type": "text/plain"});
                            res.end("Internal server error");
                        }
                        else{
                            res.end(data);
                        }
                    });
                }
            });
        }
        else{
            fs.readFile("static/index.html", (err, data) => {
                if (err){
                    res.writeHead(500, {"Content-Type": "text/plain"});
                    res.end("Internal server error");
                }
                else{
                    res.end(data);
                }
            })
        }
    }
    else if (req.url.substring(0, 8) === "/static/"){
        fs.readFile(`static/${req.url.substring(8)}`, (err, data) => {
            if (err){
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.end("Page not found");
            }
            else{
                res.end(data);}
            })
    }
    else if (req.url === "/about"){
        res.end("<h1>This page was created as a student project, in the future i would like to post here my paper connected to it and maybe even expand this webpage a bit more. Thanks for visiting!</h1>");
    } 
    else if (req.url === "/contacts"){
        res.end("<h1>Nothing here yet! More will come...</h1>");
    }
    else if(req.url === "/signUp"){
        fs.readFile("static/signUp.html", (err, data) => {
            if (err){
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end("Internal server error")
            }
            else{
                res.end(data);
            }
        });
    }
    else if(req.url === "/createUser"){
        let body ="";
        req.on("data", chunk => {
            body += chunk;
        });
        req.on("end", () => {
            const parsedBody = Object.fromEntries(new URLSearchParams(body));
            const userName = sanitizeInput(parsedBody.userName);
            const password = parsedBody.password;
            
            // Input validation
            if (!userName || !password) {
                res.writeHead(400, {"Content-Type": "text/html"});
                res.end(`
                    <html>
                    <head><title>Signup Error</title></head>
                    <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                        <h2 style="color: red;">Username and password are required</h2>
                        <a href="/signUp" style="color: #007bff;">Try again</a>
                    </body>
                    </html>
                `);
                return;
            }
            
            if (!validateUsername(userName)) {
                res.writeHead(400, {"Content-Type": "text/html"});
                res.end(`
                    <html>
                    <head><title>Signup Error</title></head>
                    <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                        <h2 style="color: red;">Username must be 3-20 characters, letters, numbers, and underscores only</h2>
                        <a href="/signUp" style="color: #007bff;">Try again</a>
                    </body>
                    </html>
                `);
                return;
            }
            
            if (!validatePassword(password)) {
                res.writeHead(400, {"Content-Type": "text/html"});
                res.end(`
                    <html>
                    <head><title>Signup Error</title></head>
                    <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                        <h2 style="color: red;">Password must be at least 6 characters long</h2>
                        <a href="/signUp" style="color: #007bff;">Try again</a>
                    </body>
                    </html>
                `);
                return;
            }
            
            db.get('SELECT COUNT(*) as count FROM Users WHERE Username = ?', [userName], (err, row) => {
                if (err){
                    console.error(err.message);
                    res.writeHead(500, {"Content-Type": "text/html"});
                    res.end(`
                        <html>
                        <head><title>Server Error</title></head>
                        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                            <h2 style="color: red;">Internal server error</h2>
                            <a href="/signUp" style="color: #007bff;">Try again</a>
                        </body>
                        </html>
                    `);
                }
                else{
                    if (row.count == 0){
                        hashPassword(password)
                            .then((hashedPassword) => {
                                db.run('INSERT INTO Users (Username, Password) VALUES (?, ?)', [userName, hashedPassword], (err) => {
                                    if (err) {
                                        console.error(err.message);
                                        res.writeHead(500, {"Content-Type": "text/html"});
                                        res.end(`
                                            <html>
                                            <head><title>Server Error</title></head>
                                            <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                                                <h2 style="color: red;">Internal server error</h2>
                                                <a href="/signUp" style="color: #007bff;">Try again</a>
                                            </body>
                                            </html>
                                        `);
                                    } else {
                                        createSession(userName, res);
                                    }
                                });
                            })
                            .catch((err) => {
                                console.error("Hashing error:", err);
                                res.writeHead(500, {"Content-Type": "text/html"});
                                res.end(`
                                    <html>
                                    <head><title>Server Error</title></head>
                                    <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                                        <h2 style="color: red;">Internal server error</h2>
                                        <a href="/signUp" style="color: #007bff;">Try again</a>
                                    </body>
                                    </html>
                                `);
                            })
                    }
                    else{
                        res.writeHead(400, {"Content-Type": "text/html"});
                        res.end(`
                            <html>
                            <head><title>Signup Error</title></head>
                            <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                                <h2 style="color: red;">Username is already in use</h2>
                                <a href="/signUp" style="color: #007bff;">Try again</a>
                            </body>
                            </html>
                        `);
                    }
                }
            });
        });
    }
    else if(req.url === "/logIn"){
        if (req.method === "POST") {
            let body = "";
            req.on("data", chunk => {
                body += chunk;
            });
            req.on("end", () => {
                const parsedBody = Object.fromEntries(new URLSearchParams(body));
                const userName = sanitizeInput(parsedBody.userName);
                const password = parsedBody.password;
                
                if (!userName || !password) {
                    res.writeHead(400, {"Content-Type": "text/html"});
                    res.end(`
                        <html>
                        <head><title>Login Error</title></head>
                        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                            <h2 style="color: red;">Username and password are required</h2>
                            <a href="/logIn" style="color: #007bff;">Try again</a>
                        </body>
                        </html>
                    `);
                    return;
                }
                
                if (!validateUsername(userName)) {
                    res.writeHead(400, {"Content-Type": "text/html"});
                    res.end(`
                        <html>
                        <head><title>Login Error</title></head>
                        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                            <h2 style="color: red;">Invalid username format</h2>
                            <a href="/logIn" style="color: #007bff;">Try again</a>
                        </body>
                        </html>
                    `);
                    return;
                }
                
                db.get(`SELECT * FROM Users WHERE Username = ?`, [userName], (err, row)=> {
                    if (err){
                        console.error(err.message);
                        res.writeHead(500, {"Content-Type": "text/html"});
                        res.end(`
                            <html>
                            <head><title>Server Error</title></head>
                            <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                                <h2 style="color: red;">Internal server error</h2>
                                <a href="/logIn" style="color: #007bff;">Try again</a>
                            </body>
                            </html>
                        `);
                    }
                    else if(row){
                        checkPassword(password, row.Password)
                            .then((check) => {
                                if (check){
                                   createSession(userName, res);
                                }
                                else{
                                    res.writeHead(401, {"Content-Type": "text/html"});
                                    res.end(`
                                        <html>
                                        <head><title>Login Failed</title></head>
                                        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                                            <h2 style="color: red;">Password or username is incorrect</h2>
                                            <a href="/logIn" style="color: #007bff;">Try again</a>
                                        </body>
                                        </html>
                                    `);
                                }
                            })
                            .catch((err) => {
                                console.error("Password check error:", err);
                                res.writeHead(500, {"Content-Type": "text/html"});
                                res.end(`
                                    <html>
                                    <head><title>Server Error</title></head>
                                    <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                                        <h2 style="color: red;">Internal server error</h2>
                                        <a href="/logIn" style="color: #007bff;">Try again</a>
                                    </body>
                                    </html>
                                `);
                            });
                    }
                    else{
                        res.writeHead(401, {"Content-Type": "text/html"});
                        res.end(`
                            <html>
                            <head><title>Login Failed</title></head>
                            <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                                <h2 style="color: red;">Password or username is incorrect</h2>
                                <a href="/logIn" style="color: #007bff;">Try again</a>
                            </body>
                            </html>
                        `);
                    }
                });
            });
        } else {
            // GET request - show login form
            fs.readFile("static/logIn.html", (err, data) => {
                if (err){
                    res.writeHead(500, {"Content-Type": "text/plain"});
                    res.end("Internal server error")
                }
                else{
                    res.end(data);
                }
            });
        }
    }
    else if(req.url === "/logOut"){
        if(sessionId){
            validateSession(sessionId, (isValid) => {
                if (isValid) {
                    db.run(`DELETE FROM Sessions WHERE SessionId = ?`, [sessionId], err => {
                        if(err){
                            res.writeHead(500);
                            res.end("Internal server error");
                        }
                        else{
                            res.writeHead(302, {
                                'Set-Cookie': 'sessionId=; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
                                "Location": '/',
                                'Content-Type': 'text/plain'
                            });
                            res.end();
                        }
                    });
                } else {
                    res.writeHead(302, {"Location": '/'});
                    res.end();
                }
            });
        }
        else{
            res.writeHead(302, {"Location": '/'});
            res.end();
        }
    }
    else if(req.url === "/latlng"){
        validateSession(sessionId, (isValid, user) => {
            if (isValid) {
                let body = "";
                req.on("data", chunk => {
                    body += chunk;
                });
                req.on("end", () => {
                    try {
                        const parsedBody = JSON.parse(body);
                        const lat = parsedBody.lat;
                        const lng = parsedBody.lng;
                        const name = sanitizeInput(parsedBody.name);
                        
                        // Input validation
                        if (!name || name.trim().length === 0) {
                            res.writeHead(400, {"Content-Type": "text/plain"});
                            res.end("Bench name is required");
                            return;
                        }
                        
                        if (!validateLatLng(lat, lng)) {
                            res.writeHead(400, {"Content-Type": "text/plain"});
                            res.end("Invalid coordinates");
                            return;
                        }
                        
                        db.run(`INSERT INTO Lavicky (Name, Lat, Lng, CreatedBy, PhotoPath) VALUES (?, ?, ?, ?, ?)`, 
                               [name, lat, lng, user, null], (err) => {
                            if (err) {
                                console.error(err.message);
                                res.writeHead(500, {"Content-Type": "text/plain"});
                                res.end("Internal server error");
                            } else {
                                res.writeHead(200, {"Content-Type": "text/plain"});
                                res.end("Bench added successfully");
                            }
                        });
                    } catch (error) {
                        console.error("JSON parse error:", error);
                        res.writeHead(400, {"Content-Type": "text/plain"});
                        res.end("Invalid JSON data");
                    }
                });
            } else {
                res.writeHead(401, {"Content-Type": "text/plain"});
                res.end("Authentication required");
            }
        });
    }
    else if(req.url === "/lavicky"){
        db.all(`select * from Lavicky`, (err, rows) => {
            if (err){
                console.error(err);
            }
            else{
                res.writeHead(200, {"Content-Type": "application/json"});
                res.end(JSON.stringify(rows));
            }
        });
    }
    else if(req.url === "/uploadPhoto"){
        validateSession(sessionId, (isValid, user) => {
            if (isValid) {
                upload.single('photo')(req, res, (err) => {
                    if (err) {
                        console.error('Upload error:', err);
                        res.writeHead(400, {"Content-Type": "text/plain"});
                        res.end("Upload failed: " + err.message);
                        return;
                    }
                    
                    if (!req.file) {
                        res.writeHead(400, {"Content-Type": "text/plain"});
                        res.end("No file uploaded");
                        return;
                    }
                    
                    const benchId = req.body.benchId;
                    if (!benchId) {
                        // Delete uploaded file if no bench ID
                        fs.unlink(req.file.path, () => {});
                        res.writeHead(400, {"Content-Type": "text/plain"});
                        res.end("Bench ID is required");
                        return;
                    }
                    
                    // Process image with Sharp (resize and optimize)
                    const processedPath = req.file.path.replace('.jpg', '_processed.jpg');
                    sharp(req.file.path)
                        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 85 })
                        .toFile(processedPath)
                        .then(() => {
                            // Delete original file
                            fs.unlink(req.file.path, () => {});
                            
                            // Update database with photo path
                            db.run(`UPDATE Lavicky SET PhotoPath = ? WHERE id = ? AND CreatedBy = ?`, 
                                   [processedPath, benchId, user], (err) => {
                                if (err) {
                                    console.error(err.message);
                                    res.writeHead(500, {"Content-Type": "text/plain"});
                                    res.end("Database update failed");
                                } else {
                                    res.writeHead(200, {"Content-Type": "application/json"});
                                    res.end(JSON.stringify({ success: true, photoPath: processedPath }));
                                }
                            });
                        })
                        .catch((err) => {
                            console.error('Image processing error:', err);
                            fs.unlink(req.file.path, () => {});
                            res.writeHead(500, {"Content-Type": "text/plain"});
                            res.end("Image processing failed");
                        });
                });
            } else {
                res.writeHead(401, {"Content-Type": "text/plain"});
                res.end("Authentication required");
            }
        });
    }
    else if(req.url.startsWith("/uploads/")){
        // Serve uploaded files
        const filePath = path.join(__dirname, req.url);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.end("File not found");
            } else {
                const ext = path.extname(filePath).toLowerCase();
                const contentType = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif'
                }[ext] || 'application/octet-stream';
                
                res.writeHead(200, {"Content-Type": contentType});
                res.end(data);
            }
        });
    }
    else{
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.end("Page not found");
    }
});

const port = 3000;

server.listen(port, () => {
    console.log("Server running at http://localhost:3000");
})
