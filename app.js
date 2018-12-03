var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame', ['account', 'progress']);



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

	// Returns the distance between entity and given point
	self.getDistance = function (pt) {
		return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2))
	}

	return self;
}

// Player Object
var Player = function (id) {
	var self = Entity();
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());

	// Player Input
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;

	// Calls Entity's update()
	var super_update = self.update;

	self.update = function () {
		self.updateSpd();
		super_update();

		if (self.pressingAttack) {
			self.shootBullet(self.mouseAngle);
			// Shotgun effect
			// for (var i = -3; i < 3; i++) self.shootBullet(i * 10 + self.mouseAngle)
		}
	}

	self.shootBullet = function (angle) {
		var b = Bullet(self.id, angle);
		// Bullet originates from player's location
		b.x = self.x;
		b.y = self.y;
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

	self.getInitPack = function () {
		return {
			id: self.id,
			x: self.x,
			y: self.y,
			number: self.number
		};
	}
	self.getUpdatePack = function () {
		return {
			id: self.id,
			x: self.x,
			y: self.y
		};
	}

	// Add player to list of players
	Player.list[id] = self;

	// Add player info to initPack to send to client
	initPack.player.push(self.getInitPack());

	return self;
}

// List of players
Player.list = {};

// Creates new player depending on socket.id
Player.onConnect = function (socket) {
	var player = Player(socket.id);

	// Adds listener for keyPress packages
	// Player keyboard input
	socket.on('keyPress', function (data) {
		if (data.inputId === 'up') player.pressingUp = data.state;
		else if (data.inputId === 'down') player.pressingDown = data.state;
		else if (data.inputId === 'left') player.pressingLeft = data.state;
		else if (data.inputId === 'right') player.pressingRight = data.state;
		else if (data.inputId === 'attack') player.pressingAttack = data.state;
		else if (data.inputId === 'mouseAngle') player.mouseAngle = data.state;
	});

	var bullets = [];
	for (var i in Player.list) {
		bullets.push(Player.list[i].getInitPack());
	}

	socket.emit('init', {
		player: Player.getAllInitPack(),
		bullet: Bullet.getAllInitPack()
	});
}

// Return initPack data for all players
Player.getAllInitPack = function () {
	var players = [];
	for (var i in Player.list) {
		players.push(Player.list[i].getInitPack());
	}
	return players;
}

// Called when player disconnects
// remove player from player list
Player.onDisconnect = function (socket) {
	delete Player.list[socket.id];
	removePack.player.push(socket.id);
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
		pack.push(player.getUpdatePack());
	}
	return pack;
}

var Bullet = function (parent, angle) {
	var self = Entity();
	self.id = Math.random();
	self.parent = parent;
	self.spdX = Math.cos(angle / 180 * Math.PI) * 10;
	self.spdY = Math.sin(angle / 180 * Math.PI) * 10;

	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function () {
		if (self.timer++ > 100)
			self.toRemove = true;
		super_update();

		for (var i in Player.list) {
			var p = Player.list[i];
			// Check if bullet collides with any players
			if (self.getDistance(p) < 32 && self.parent != p.id) {
				// handle collision. ex: hp--;
				self.toRemove = true;
			}
		}
	}

	self.getInitPack = function () {
		return {
			id: self.id,
			x: self.x,
			y: self.y
		}
	}

	self.getUpdatePack = function () {
		return {
			id: self.id,
			x: self.x,
			y: self.y
		}
	}

	Bullet.list[self.id] = self;

	// Add bullet info to initPack to send to client
	initPack.bullet.push(self.getInitPack());

	return self;
}

Bullet.list = {};

// Update all bullets
// creates package that gets returned to setInterval (main game loop)
Bullet.update = function () {
	var pack = [];
	for (var i in Bullet.list) {
		var bullet = Bullet.list[i];
		// Player keyboard input
		bullet.update();

		if (bullet.toRemove == true) {
			delete Bullet.list[i];
			// Add bullet id to removePack to be removed from client list of bullets
			removePack.bullet.push(bullet.id);
		}

		// Create package of bullet info to send to clients
		else
			pack.push(bullet.getUpdatePack());
	}
	return pack;
}

// Return initPack data for all bullets
Bullet.getAllInitPack = function () {
	var bullets = [];
	for (var i in Bullet.list) {
		bullets.push(Bullet.list[i].getInitPack());
	}
	return bullets;
}

// Bool to allow debug commands from chat box
var DEBUG = true;

var USERS = {
	// Username:Password
	"bob": "asd",
	"alice": "123",
	"pat": "poop"
}

// Returns true if password matches username in USERS array
var isValidPassword = function (data, callback) {
	db.account.find({ username: data.username, password: data.password }, function (err, res) {
		if (res.length > 0)
			callback(true);
		else
			callback(false);
	});
}

// Returns if user is already in USERS array
var isUsernameTaken = function (data, callback) {
	db.account.find({ username: data.username }, function (err, res) {
		if (res.length > 0)
			callback(true);
		else
			callback(false);
	});
}

// Adds user to USERS array
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

	socket.on('signIn', function (data) {
		isValidPassword(data, function (result) {
			if (result) {
				Player.onConnect(socket);
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

	// When server recieves 'sendMsgToServer', send chat messages to all clients
	socket.on('sendMsgToServer', function (data) {
		var playerName = ("" + socket.id).slice(2, 7);

		for (var i in SOCKET_LIST) {
			SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data);
		}
	});

	// When server recieves a message it should evaluate (for debug purposes)
	socket.on('evalServer', function (data) {
		if (!DEBUG) return;
		var res = eval(data);
		socket.emit('evalAnswer', res);
	});

});

var initPack = {
	player: [],
	bullet: []
};

var removePack = {
	player: [],
	bullet: []
}

// Main loop of the game
// Every 40ms loop through sockets and increase x & y and send new coordinates to client
setInterval(function () {
	var pack = {
		player: Player.update(),
		bullet: Bullet.update(),
	}

	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];

		socket.emit('init', initPack);
		socket.emit('update', pack);
		socket.emit('remove', removePack);
	}

	// Reset packages
	initPack.player = [];
	initPack.bullet = [];
	removePack.player = [];
	removePack.bullet = [];

}, 1000 / 25);