var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var roomCount = 0;
var waiting = [];
var roomDir = {};
var activeGames = {};

const PROMPTS = {
    'Write a Shakespearean sonnet about your favorite breakfast food.': {'time': 10},
    'Write a passive-agressive haiku.': {},
    'It was seven in the morning, and Arnold was already ': {},
    'She suspected they would come, but she never thought they\'d come now.': {}
}

function score (msg, prompt) {
    return Math.floor((msg.length - prompt.length) / 20) * 10;
};

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.use(express.static('public'));

io.on('connection', function (socket) {
    console.log('user connected');
    socket.on('join game queue', function (msg) {
        console.log('user joined game queue')
        if (waiting.length > 0) {
            let room = 'ROOM' + roomCount;
            let prompt = Object.keys(PROMPTS)[Math.floor(Math.random() * Object.keys(PROMPTS).length)];
            let otherSocket = waiting.shift();
            socket.join(room);
            otherSocket.join(room);
            roomDir[socket.id] = room;
            roomDir[otherSocket.id] = room;
            io.in(room).emit('start room', prompt);
            roomCount++;
            console.log('started ' + room);
            let timeLoop = setInterval( function () {
                if (activeGames[room].time > 0) {
                    activeGames[room].time--;
                    io.in(room).emit('time sync', activeGames[room].time);
                } else {
                    io.in(room).emit('end game');
                    clearInterval(activeGames[room].timeLoop);
                }
            }, 1000)
            activeGames[room] = {
                prompt,
                time: 306,
                timeLoop,
                score: {
                    [socket.id]: 0,
                    [otherSocket.id]: 0
                }
            };

            // handle scoring, word suggestions
            // handle line breaks not transferring
            // initial description page/blurb
            // git

        } else {
            waiting.push(socket);
        }
    });
    socket.on('disconnect', function () {
        if (waiting.includes(socket)) {
            waiting.splice(waiting.indexOf(socket), 1);
            console.log('user removed from waiting queue');
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
            let newScore = score(msg, activeGames[roomDir[socket.id]].prompt);
            if (newScore !== activeGames[roomDir[socket.id]].score[socket.id]) {
                activeGames[roomDir[socket.id]].score[socket.id] = newScore;
                io.in(roomDir[socket.id]).emit('update scores', activeGames[roomDir[socket.id]].score);
            }
        }
    });
});

http.listen(3000, function () {
    console.log('listening on *:3000');
});
