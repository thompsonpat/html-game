// Express code for sending files
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log('Server started.');

var SOCKET_LIST = {};

// Socket.io code
var io = require('socket.io')(serv, {});
// when connection is made this code is called
io.sockets.on('connection', function (socket) {
    socket.id = Math.random();          // Socket gets unique id
    socket.x = 0;                       // Set socket postion
    socket.y = 0;
    socket.number = "" + Math.floor(10 * Math.random());
    SOCKET_LIST[socket.id] = socket;    // Socket added to list of connected sockets

    // When player leaves, disconnect messages is automatically sent to server
    // Remove socket from socket list when player leaves
    socket.on('disconnect', function () {
        delete SOCKET_LIST[socket.id];
    });
});

// Every 40ms loop through sockets and increase x & y and send new coordinates to client
setInterval(function () {
    var pack = [];
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.x++;
        socket.y++;
        pack.push({
            x: socket.x,
            y: socket.y,
            number: socket.number
        });
    }
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('newPositions', pack);
    }
}, 1000 / 25);