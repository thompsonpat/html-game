var initPack = {
    player: [],
    bullet: []
};

var removePack = {
    player: [],
    bullet: []
}

SOCKET_LIST = {};

Entity = function (param) {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: "",
        map: 'forest',
    }

    if (param) {
        if (param.x) self.x = param.x;
        if (param.y) self.y = param.y;
        if (param.map) self.map = param.map;
        if (param.id) self.id = param.id;
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

Entity.getFrameUpdateData = function () {
    var pack = {
        initPack: {
            player: initPack.player,
            bullet: initPack.bullet,
        },
        removePack: {
            player: removePack.player,
            bullet: removePack.bullet,
        },
        updatePack: {
            player: Player.update(),
            bullet: Bullet.update(),
        }
    };
    // Reset Packs
    initPack.player = [];
    initPack.bullet = [];
    removePack.player = [];
    removePack.bullet = [];
    return pack;
}

Player = function (param) {
    var self = Entity(param);	// Super constructor
    self.number = "" + Math.floor(10 * Math.random());
    self.username = param.username;

    // Player Input
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.pressingAttack = false;
    self.mouseAngle = 0;
    self.maxSpd = 10;

    self.hp = 10;
    self.hpMax = 10;
    self.kills = 0;
    self.inventory = new Inventory(param.socket, true);

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
        if (Math.random() < 0.1) self.inventory.addItem("ammo", 1);
        Bullet({
            parent: self.id,
            angle: angle,
            x: self.x,	// Bullet originates from player's location
            y: self.y,
            map: self.map,
        });
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
            number: self.number,
            hp: self.hp,
            hpMax: self.hpMax,
            kills: self.kills,
            map: self.map,
        };
    }
    self.getUpdatePack = function () {
        return {
            id: self.id,
            x: self.x,
            y: self.y,
            hp: self.hp,
            kills: self.kills,
            map: self.map,
        };
    }

    // Add player to list of players
    Player.list[self.id] = self;

    // Add player info to initPack to send to client
    initPack.player.push(self.getInitPack());

    return self;
}

// List of players
Player.list = {};

// Creates new player depending on socket.id
Player.onConnect = function (socket, username) {
    var map = 'forest';
    // if (Math.random() < 0.5) map = 'field';

    var player = Player({
        username: username,
        id: socket.id,
        map: map,
        socket: socket,
    });

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

    socket.on('changeMap', function (data) {
        if (player.map === 'field') player.map = 'forest';
        else player.map = 'field';
    });

    var bullets = [];
    for (var i in Player.list) {
        bullets.push(Player.list[i].getInitPack());
    }

    // When server recieves 'sendMsgToServer', send chat messages to all clients
    socket.on('sendMsgToServer', function (data) {
        for (var i in SOCKET_LIST) {
            SOCKET_LIST[i].emit('addToChat', player.username + ': ' + data);
        }
    });

    socket.on('sendPMToServer', function (data) { // data: {username, message}
        // Start as null in case player does not exist
        var recipientSocket = null;

        for (var i in Player.list) {
            if (Player.list[i].username === data.username)
                recipientSocket = SOCKET_LIST[Player.list[i].id];
        }

        if (recipientSocket === null) {
            socket.emit('addToChat', 'The player ' + data.username + ' is not online.');
        } else {
            recipientSocket.emit('addToChat', 'From ' + player.username + ': ' + data.message);
            socket.emit('addToChat', 'To ' + data.username + ': ' + data.message);
        }
    });

    socket.emit('init', {
        selfId: socket.id,
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

Bullet = function (param) {
    var self = Entity(param);	// Super constructor
    self.id = Math.random();
    self.angle = param.angle;
    self.spdX = Math.cos(param.angle / 180 * Math.PI) * 10;
    self.spdY = Math.sin(param.angle / 180 * Math.PI) * 10;
    self.parent = param.parent;

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
            if (self.map === p.map && self.getDistance(p) < 32 && self.parent != p.id) {
                // handle collision
                p.hp -= 1;

                // If killed
                if (p.hp <= 0) {
                    var shooter = Player.list[self.parent];
                    if (shooter) shooter.kills += 1;	// If shooter still connected
                    p.hp = p.hpMax;
                    p.x = Math.random() * 500;
                    p.y = Math.random() * 500;
                }

                self.toRemove = true;
            }
        }
    }

    self.getInitPack = function () {
        return {
            id: self.id,
            x: self.x,
            y: self.y,
            map: self.map,
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