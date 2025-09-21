const http = require("http");
const fs = require("fs");
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('users.db');

const insert = db.prepare(`insert into Users (Username, Password) values (?, ?)`);
const input = db.prepare(`insert into Lavicky (Name, Lat, Lng) values (?, ?, ?)`);

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
    const newSessionId = Math.random().toString(36).substring(2, 16);
    console.log(newSessionId);
    db.run(`insert into Sessions (SessionId, User) values (?, ?)`, [newSessionId, userName], err => {
        if(err){
            res.writeHead(500);
            res.end("Internal server error");
        }
        else{
            res.writeHead(302, {
                "Set-Cookie": `sessionId = ${newSessionId}; HttpOnly`,
                "Location": '/',
                "Content-Type": "text/plain"
            });
            res.end();                            
        }
    });
}


const server = http.createServer((req, res) => {
    console.log(req.url);

    const cookies = parseCookies(req);
    const sessionId = cookies.sessionId;
    console.log(sessionId);

    if (req.url === "/"){
        // db.each(`select * from Users`, (err, rows) => {
        //     if (err){
        //         console.error(err.message);
        //     }
        //     else{
        //         console.log(rows);
        //     }
        // });

        if(sessionId){
            fs.readFile("static/index2.html", (err, data) => {
                if (err){
                    res.writeHead(500, {"Content-Type": "text/plain"});
                    res.end("Internal server error");
                }
                else{
                    res.end(data);
                }
            })
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
            const userName = parsedBody.userName;
            const password = parsedBody.password;
            if (userName && password != null){
                db.get('SELECT * FROM Users WHERE Username = ?', [userName], (err, row) => {
                    if (err){
                        console.error(err.message);
                    }
                    else{
                        console.log(row.count);
                        if (row.count == 0){
                            hashPassword(password)
                                .then((hashedPassword) => {
                                    insert.run(userName, hashedPassword);
                                    createSession(userName, res);
                                })
                                .catch((err) => {
                                    console.error("Hashing error:", err);
                                })
                        }
                        else{
                            res.end("Username is already in use");
                        }
                    }
                });
            }
        });
    }
    else if(req.url === "/logIn"){
        let body ="";
        req.on("data", chunk => {
            body += chunk;
        });
        fs.readFile("static/logIn.html", (err, data) => {
            if (err){
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end("Internal server error")
            }
            else{
                const parsedBody = Object.fromEntries(new URLSearchParams(body));
                const userName = parsedBody.userName;
                const password = parsedBody.password;
                db.each(`select Username from Users`, (err, row) => {
                    if(err){
                        console.error(err.message);
                    }
                    else{
                        console.log(row);
                    } 
                });
                if (userName && password != null){
                    db.all(`select * from Users where Username = ?`, [userName], (err, rows)=> {
                        if (err){
                            console.error(err.message);
                        }
                        if(rows && rows.length>0){
                            // console.log("found a match:", rows);
                            // console.log(rows[0].Password);
                            checkPassword(password, rows[0].Password)
                                .then((check) => {
                                    if (check){
                                       createSession(userName, res);
                                    }
                                    else{
                                        res.end("<h1>Password or username is incorrect</h1>");
                                        //console.log("incorrect password");
                                    }
                                })
                        }
                        else{
                            //console.log("incorrect");
                            res.end("<h1>Password or username is incorrect</h1>");
                        }
                    });
                }
                else{
                    res.end(data);
                }
                
            }
        });
    }
    else if(req.url === "/logOut"){
        if(sessionId){
            db.run(`delete from Sessions where SessionId = ?`, [sessionId], err => {
                if(err){
                    res.writeHead(500);
                    res.end("Internal server error");
                }
                else{
                    res.writeHead(302, {
                        'Set-Cookie': 'sessionId=; HttpOnly; Max-Age=0',
                        "Location": '/',
                        'Content-Type': 'text/plain'
                    });
                    res.end();
                }
            })
        }
        else{
            res.writeHead(302, {"Location": '/'});
            res.end();
        }
    }
    else if(req.url === "/latlng"){
        if(sessionId){
            let body = "";
            req.on("data", chunk => {
                body += chunk;
            });
            req.on("end", () => {
                const parsedBody = JSON.parse(body);
                const lat = parsedBody.lat;
                const lng = parsedBody.lng;
                const name = parsedBody.name;
                input.run(name, lat, lng);
                db.each(`select * from Lavicky`, (err, rows) => {
                    if (err){
                        console.error(err.message);
                    }
                    else{
                        console.log(rows);
                    }
                });  
            });
            res.writeHead(200);
            res.end();
        }
        else{
            res.end()//nejak vymyslet info o neprihlasenosti.......neni treba, tohle funguje protoze neni tlacitko pridat lavicku...stejne pro jistotu nechat...
        }
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
    else{
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.end("Page not found");
    }
});

const port = 3000;

server.listen(port, () => {
    console.log("Server running at http://localhost:3000");
})
