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
var PLAYER_LIST = {};

// Player Object
var Player = function (id) {
	// Constructor
	var self = {
		x: 250,
		y: 250,
		id: id,
		number: "" + Math.floor(10 * Math.random()),
		// Player Keyboard Input
		pressingRight: false,
		pressingLeft: false,
		pressingUp: false,
		pressingDown: false,
		maxSpd: 10,
	}
	self.updatePosition = function () {
		if (self.pressingUp) self.y -= self.maxSpd;
		if (self.pressingDown) self.y += self.maxSpd;
		if (self.pressingLeft) self.x -= self.maxSpd;
		if (self.pressingRight) self.x += self.maxSpd;
	}
	return self;
}

// Socket.io code
var io = require('socket.io')(serv, {});
// when connection is made this code is called
io.sockets.on('connection', function (socket) {
	socket.id = Math.random();          // Socket gets unique id
	SOCKET_LIST[socket.id] = socket;    // Socket added to list of connected sockets

	// Create player and add to player list
	var player = Player(socket.id);
	PLAYER_LIST[socket.id] = player;

	// When player leaves, disconnect messages is automatically sent to server
	// Remove socket and player from lists
	socket.on('disconnect', function () {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});

	// Player keyboard input
	socket.on('keypress', function (data) {
		if (data.inputId === 'up')
			player.pressingUp = data.state;
		else if (data.inputId === 'down')
			player.pressingDown = data.state;
		else if (data.inputId === 'left')
			player.pressingLeft = data.state;
		else if (data.inputId === 'right')
			player.pressingRight = data.state;
	});
});

// Every 40ms loop through sockets and increase x & y and send new coordinates to client
setInterval(function () {
	var pack = [];
	for (var i in PLAYER_LIST) {
		var player = PLAYER_LIST[i];

		// Player keyboard input
		player.updatePosition();

		pack.push({
			x: player.x,
			y: player.y,
			number: player.number
		});
	}
	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions', pack);
	}
}, 1000 / 25);