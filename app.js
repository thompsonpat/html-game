console.log('Hello World!');


// Express code for sending files
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log('Server started.');

// Socket.io code
var io = require('socket.io')(serv,{});
// when connection is made this code is called
io.sockets.on('connection', function(socket){
    console.log('socket connection');

    socket.on('happy',function(data){
        console.log('happy because ' + data.reason);
    });
   
    socket.emit('serverMsg',{
        msg:'hello',
    });
});