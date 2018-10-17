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
                reject();
            });
        })
    )
};

app.use(express.static('public'));

io.on('connection', function (socket) {
    console.log('user connected');
    socket.on('join game queue', function (type) {
        console.log('user joined game queue')
        if (type == 'prompted' || type == 'freewrite') {
            if (waiting[type].length > 0) {
                let room = 'ROOM' + roomCount;
                let otherSocket = waiting[type].shift();
                socket.join(room);
                otherSocket.join(room);
                roomDir[socket.id] = room;
                roomDir[otherSocket.id] = room;
                roomCount++;
                if (type == 'prompted') {
                    // let prompt = Object.keys(CONSTANTS.PROMPTS)[Math.floor(Math.random() * Object.keys(CONSTANTS.PROMPTS).length)];
                    getRandomPrompt()
                    .then((prompt) => {
                        io.in(room).emit('start prompted room', prompt);
                        activeGames[room] = {
                            type,
                            prompt,
                            time: CONSTANTS.GAMETIME,
                            timeLoop,
                            // score: {
                            //     [socket.id]: 0,
                            //     [otherSocket.id]: 0
                            // }
                        };
                        let timeLoop = setInterval(function () {
                            if (activeGames[room]) {
                                if (activeGames[room].time > 0) {
                                    activeGames[room].time--;
                                    io.in(room).emit('time sync', activeGames[room].time);
                                    if (Math.random() * 50 < 1) {
                                        console.log(Math.floor(Math.random() * CONSTANTS.WORDS.length))
                                        console.log('random word:' + CONSTANTS.WORDS[Math.floor(Math.random() * CONSTANTS.WORDS.length)])
                                        io.in(room).emit('random word', CONSTANTS.WORDS[Math.floor(Math.random() * CONSTANTS.WORDS.length)]);
                                        // store in game state too
                                    }
                                } else {
                                    // io.in(room).emit('end game', activeGames[room].score);
                                    io.in(room).emit('end game');
                                    clearInterval(activeGames[room].timeLoop);
                                }
                            }
                        }, 1000)
                    }) // TODO: catch error and use custom prompt if necessary
                } else {
                    io.in(room).emit('start freewrite room');
                    activeGames[room] = {
                        type
                    };
                }
                console.log('started ' + room);
            } else {
                waiting[type].push(socket);
            }
        }
        
    });
    socket.on('disconnect', function () {
        if (waiting.prompted.includes(socket)) {
            waiting.prompted.splice(waiting.prompted.indexOf(socket), 1);
        } else if (waiting.freewrite.includes(socket)) {
            waiting.freewrite.splice(waiting.freewrite.indexOf(socket), 1);
        }
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
            // let newScore = score(msg, activeGames[roomDir[socket.id]].prompt);
            // if (newScore !== activeGames[roomDir[socket.id]].score[socket.id]) {
            //     activeGames[roomDir[socket.id]].score[socket.id] = newScore;
            //     io.in(roomDir[socket.id]).emit('update scores', activeGames[roomDir[socket.id]].score);
            // }
        }
    });
});

var port = process.env.PORT || 3000;

http.listen(port, function () {
    console.log('listening on *:' + port);
});
