const CONSTANTS = require('./constants');
var express = require('express');
var app = express();
var favicon = require('serve-favicon')
var path = require('path')
var http = require('http').Server(app);
var https = require('https');
var io = require('socket.io')(http);

var roomCount = 0;
var waiting = { prompted: [], freewrite: [] };
var typeSwap = { prompted: "freewrite", freewrite: "prompted" }
var roomDir = {};
var activeGames = {};

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

function score (msg, prompt) {
    return Math.floor((msg.length - prompt.length) / 20) * 10;
};

function getRandomPrompt () {
    return (
        new Promise((resolve, reject) => {
            https.get('https://www.ineedaprompt.com/dictionary/default/prompt?q=' + CONSTANTS.PROMPT_CONFIGS[Math.floor(Math.random() * CONSTANTS.PROMPT_CONFIGS.length)], (resp) => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    resolve(JSON.parse(data).english.slice(0, -1));
                });
            }).on("error", (err) => {
                console.log("Error: " + err.message);
                resolve('Uh oh, there was an error loading a prompt! Freestyle time?');
            });
        })
    )
};

app.use(express.static('public'));

io.on('connection', function (socket) {
    console.log('user connected');
    function joinGameQueue (type) {
        console.log('user joined game queue')
        if (type == 'prompted' || type == 'freewrite') {
            if (waiting[type].length > 0) {
                let room = 'ROOM' + roomCount;
                let otherSocket = waiting[type].shift();
                if (waiting[typeSwap[type]].length > 0) { waiting[typeSwap[type]][0].emit('clear user in other queue') };
                socket.join(room);
                otherSocket.join(room);
                roomDir[socket.id] = room;
                roomDir[otherSocket.id] = room;
                roomCount++;
                if (type == 'prompted') {
                    getRandomPrompt()
                    .then((prompt) => {
                        io.in(room).emit('start prompted room', prompt);
                        let timeLoop = setInterval(function () {
                            if (activeGames[room]) {
                                if (activeGames[room].time > 0) {
                                    activeGames[room].time--;
                                    io.in(room).emit('time sync', activeGames[room].time);
                                } else {
                                    io.in(room).emit('end game');
                                    clearInterval(activeGames[room].timeLoop);
                                }
                            }
                        }, 1000)
                        activeGames[room] = {
                            type,
                            prompt,
                            time: CONSTANTS.GAMETIME,
                            timeLoop
                        };
                    }).catch((err) => {
                        console.log('Error: ' + err);
                    })
                } else {
                    io.in(room).emit('start freewrite room');
                    activeGames[room] = {
                        type
                    };
                }
                console.log('started ' + room);
            } else {
                waiting[type].push(socket);
                setTimeout(function () {
                    if (waiting[type].includes(socket) > 0 && waiting[typeSwap[type]].length > 0) {
                        socket.emit('user in other queue', typeSwap[type]);
                    }
                }, 5000)
            }
        }
    }
    socket.on('join game queue', function (type) {
        joinGameQueue(type);
    });
    function removeSocketFromQueues () {
        if (waiting.prompted.includes(socket)) {
            waiting.prompted.splice(waiting.prompted.indexOf(socket), 1);
            if (waiting.freewrite.length > 0) { waiting.freewrite[0].emit('clear user in other queue'); };
            return('prompted');
        } else if (waiting.freewrite.includes(socket)) {
            waiting.freewrite.splice(waiting.freewrite.indexOf(socket), 1);
            if (waiting.prompted.length > 0) { waiting.prompted[0].emit('clear user in other queue'); };
            return('freewrite');
        }
    }
    socket.on('swap user queue', function () {
        joinGameQueue(typeSwap[removeSocketFromQueues()]);
    })
    socket.on('disconnect', function () {
        removeSocketFromQueues();
        let room = roomDir[socket.id];
        if (room) {
            socket.broadcast.to(room).emit('active user disconnect');
            if (activeGames[room]) {
                clearInterval(activeGames[room].timeLoop);
                delete activeGames[room];
            }
        }
        console.log('user disconnected');
    });
    socket.on('update text', function (msg) {
        if (roomDir[socket.id]) {
            socket.broadcast.to(roomDir[socket.id]).emit('update text', msg);
        }
    });
});

var port = process.env.PORT || 3000;

http.listen(port, function () {
    console.log('listening on *:' + port);
});
