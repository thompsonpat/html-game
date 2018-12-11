var USE_DATABASE = true;
var mongojs = USE_DATABASE ? require('mongojs') : null;
var db = USE_DATABASE ? mongojs('localhost:27017/myGame', ['account', 'progress']) : null;

Database = {};

// account: { username: string, password: string }
// progress: { username: string, items: [{id: string, amount: number}] }

// Returns true if password matches username in database
Database.isValidPassword = function (data, callback) {
    if (!USE_DATABASE) return callback(true);
    db.account.findOne({ username: data.username, password: data.password }, function (err, res) {
        if (res)
            callback(true);
        else
            callback(false);
    });
}

// Returns if user is already in database
Database.isUsernameTaken = function (data, callback) {
    if (!USE_DATABASE) return callback(true);
    db.account.findOne({ username: data.username }, function (err, res) {
        if (res)
            callback(true);
        else
            callback(false);
    });
}

// Adds user to database
Database.addUser = function (data, callback) {
    if (!USE_DATABASE) return callback(true);
    db.account.insert({ username: data.username, password: data.password }, function (err) {
        Database.savePlayerProgress({ username: data.username, items: [] }, function () {
            callback();
        });
    });
}

Database.getPlayerProgress = function (username, callback) {
    if (!USE_DATABASE) return callback({ items: [] });
    db.progress.findOne({ username: username }, function (err, res) {
        callback({ items: res.items });
    });
}

Database.savePlayerProgress = function (data, callback) {
    callback = callback || function () { }  // for optional param
    if (!USE_DATABASE) return callback();
    db.progress.update({ username: data.username }, data, { upsert: true }, callback);
}