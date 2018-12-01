// ================== EXPRESS CODE (FILE TRANSFER) ================== //
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));
// ================== EXPRESS CODE (FILE TRANSFER) ================== //

serv.listen(2000);
console.log('Server started.');


var SOCKET_LIST = {};

var Entity = function () {
	var self = {
		x: 250,
		y: 250,
		spdX: 0,
		spdY: 0,
		id: "",
	}

	self.update = function () {
		self.updatePosition();
	}

	// Move entity based on their speed
	self.updatePosition = function () {
		self.x += self.spdX;
		self.y += self.spdY;
	}

	return self;
}

// Player Object
var Player = function (id) {
	var self = Entity();
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());

	// Player Keyboard Input
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.maxSpd = 10;

	// Calls Entity's update()
	var super_update = self.update;

	self.update = function () {
		self.updateSpd();
		super_update();
	}

	// Override entity's updatePosition()
	self.updateSpd = function () {
		// Update vertical movement
		if (self.pressingUp) self.spdY = -self.maxSpd;
		else if (self.pressingDown) self.spdY = self.maxSpd;
		else self.spdY = 0;

		// Update horizontal movement
		if (self.pressingLeft) self.spdX = -self.maxSpd;
		else if (self.pressingRight) self.spdX = self.maxSpd;
		else self.spdX = 0;
	}

	// Add player to list of players
	Player.list[id] = self;

	return self;
}

// List of players
Player.list = {};

// Creates new player depending on socket.id
Player.onConnect = function (socket) {
	var player = Player(socket.id);

	// Adds listener for keyPress packages
	// Player keyboard input
	socket.on('keypress', function (data) {
		if (data.inputId === 'up') player.pressingUp = data.state;
		else if (data.inputId === 'down') player.pressingDown = data.state;
		else if (data.inputId === 'left') player.pressingLeft = data.state;
		else if (data.inputId === 'right') player.pressingRight = data.state;
	});
}

// Called when player disconnects
// remove player from player list
Player.onDisconnect = function (socket) {
	delete Player.list[socket.id];
}

// Update all players
// creates package that gets returned to setInterval (main game loop)
Player.update = function () {
	var pack = [];
	for (var i in Player.list) {
		var player = Player.list[i];
		// Player keyboard input
		player.update();
		// Create package of player info to send to clients
		pack.push({
			x: player.x,
			y: player.y,
			number: player.number
		});
	}
	return pack;
}

// ================== SOCKET.io CODE ================== //
var io = require('socket.io')(serv, {});

// when connection is made this code is called
io.sockets.on('connection', function (socket) {
	// Socket gets unique id
	socket.id = Math.random();

	// Socket added to list of connected sockets
	SOCKET_LIST[socket.id] = socket;

	Player.onConnect(socket);

	// When player leaves, disconnect messages is automatically sent to server
	// Remove socket and player from lists
	socket.on('disconnect', function () {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});

});

// Main loop of the game
// Every 40ms loop through sockets and increase x & y and send new coordinates to client
setInterval(function () {
	var pack = Player.update();

	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];

		// Set new positions to players
		socket.emit('newPositions', pack);
	}

}, 1000 / 25);