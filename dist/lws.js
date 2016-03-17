const EventEmitter = require('events');
const util = require('util');

module.exports = require('./lws_' + process.platform + '_' + process.versions.modules);

function wsSocket(lwsSocket, server) {
	EventEmitter.call(this);
	var wsSocket = this;
	this.lwsSocket = lwsSocket;
	this.server = server;
	this.next = this.prev = null;

	this.send = function (message, options) {
		if (wsSocket.lwsSocket != null) {
			var binary = false;
			if (options != undefined) {
				binary = options.binary;
			}
			wsSocket.server.send(wsSocket.lwsSocket, message, binary);
		} else {
			// just ignore sends on closed sockets
		}
	}
}

module.exports.wsServer = function wsServer(options) {
	EventEmitter.call(this);
	var server = new module.exports.Server(options);
	var wsServer = this;
	var clients = null;

	this.close = function () {
		server.close();
	};

	this.broadcast = function (message, options) {
		if (clients != null) {
			var binary = false;
			if (options != undefined) {
				binary = options.binary;
			}
			var preparedBuffer = server.prepareBuffer(new Buffer(message));
			for (var it = clients; it != null; it = it.next) {
				server.sendPrepared(it.lwsSocket, preparedBuffer, binary);
			}
		}
	}

	server.on('connection', function (socket) {
		var ws = new wsSocket(socket, server);
		server.setUserData(socket, ws);

		if (clients == null) {
			clients = ws;
		} else {
			clients.prev = ws;
			ws.next = clients;
			clients = ws;
		}

		wsServer.emit('connection', ws);
	});

	server.on('message', function (socket, message, binary, bytesRemaining) {
		var ws = server.getUserData(socket);
		ws.emit('message', message);
	});

	server.on('close', function (socket) {
		var ws = server.getUserData(socket);
		ws.lwsSocket = null;

		if (ws.prev == ws.next) {
			clients = null;
		} else {
			if (ws.prev != null) {
				ws.prev.next = ws.next;
			} else {
				clients = ws.next;
			}
			if (ws.next != null) {
				ws.next.prev = ws.prev;
			}
		}

		ws.emit('close');
	});
};

util.inherits(wsSocket, EventEmitter);
util.inherits(module.exports.wsServer, EventEmitter);
