var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame', ['account', 'progress']);

require('./Entity');
require('./client/Inventory');

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

// var SOCKET_LIST = {};

// Bool to allow debug commands from chat box
var DEBUG = true;

// Returns true if password matches username in database
var isValidPassword = function (data, callback) {
	db.account.find({ username: data.username, password: data.password }, function (err, res) {
		if (res.length > 0)
			callback(true);
		else
			callback(false);
	});
}

// Returns if user is already in database
var isUsernameTaken = function (data, callback) {
	db.account.find({ username: data.username }, function (err, res) {
		if (res.length > 0)
			callback(true);
		else
			callback(false);
	});
}

// Adds user to database
var addUser = function (data, callback) {
	db.account.insert({ username: data.username, password: data.password }, function (err) {
		callback();
	});
}

// ================== SOCKET.io CODE ================== //
var io = require('socket.io')(serv, {});

// when connection is made this code is called
io.sockets.on('connection', function (socket) {
	// Socket gets unique id
	socket.id = Math.random();

	// Socket added to list of connected sockets
	SOCKET_LIST[socket.id] = socket;

	socket.on('signIn', function (data) { // data: {username, password}
		isValidPassword(data, function (result) {
			if (result) {
				Player.onConnect(socket, data.username);
				socket.emit('signInResponse', { success: true });
			} else {
				socket.emit('signInResponse', { success: false });
			}
		});
	});

	socket.on('signUp', function (data) {
		isUsernameTaken(data, function (result) {
			if (result) {
				socket.emit('signUpResponse', { success: false });
			} else {
				addUser(data, function () {
					socket.emit('signUpResponse', { success: true });
				});
			}
		});
	});

	// When player leaves, disconnect messages is automatically sent to server
	// Remove socket and player from lists
	socket.on('disconnect', function () {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});

	// When server recieves a message it should evaluate (for debug purposes)
	socket.on('evalServer', function (data) {
		if (!DEBUG) return;
		var res = eval(data);
		socket.emit('evalAnswer', res);
	});

});

// Main loop of the game
// Every 40ms loop through sockets and increase x & y and send new coordinates to client
setInterval(function () {
	var packs = Entity.getFrameUpdateData();
	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('init', packs.initPack);
		socket.emit('update', packs.updatePack);
		socket.emit('remove', packs.removePack);
	}
}, 1000 / 25);