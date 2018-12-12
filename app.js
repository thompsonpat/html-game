require('./Database')
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

var SOCKET_LIST = {};

// Bool to allow debug commands from chat box
var DEBUG = true;

// ================== SOCKET.io CODE ================== //
var io = require('socket.io')(serv, {});

// when connection is made this code is called
io.sockets.on('connection', function (socket) {
	// Socket gets unique id
	socket.id = Math.random();

	// Socket added to list of connected sockets
	SOCKET_LIST[socket.id] = socket;

	socket.on('signIn', function (data) { // data: {username, password}
		Database.isValidPassword(data, function (result) {
			if (!result) return socket.emit('signInResponse', { success: false });
			Database.getPlayerProgress(data.username, function (progress) {
				Player.onConnect(socket, data.username, progress);
				socket.emit('signInResponse', { success: true });
			});
		});
	});

	socket.on('signUp', function (data) {
		Database.isUsernameTaken(data, function (result) {
			if (result) {
				socket.emit('signUpResponse', { success: false });
			} else {
				Database.addUser(data, function () {
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