//--------------------------------------------------
//  Bi-Directional OSC messaging Websocket <-> UDP
// example from: 
//--------------------------------------------------
var osc = require("osc"),
    WebSocket = require("ws");
var https = require('https');
var fs = require('fs');
var portscanner = require('portscanner');
var static = require('node-static');

var ports = [];

var options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

var file = new static.Server('./public');

var httpsServer = https.createServer(options, function (request, response) {
  request.addListener('end', function () {
        //
        // Serve files!
        //
        file.serve(request, response);
    }).resume();
}).listen(8000);

var wss = new WebSocket.Server({
    //port: 8081
    server: httpsServer
});


var getIPAddresses = function () {
    var os = require("os"),
    interfaces = os.networkInterfaces(),
    ipAddresses = [];

    for (var deviceName in interfaces){
        var addresses = interfaces[deviceName];

        for (var i = 0; i < addresses.length; i++) {
            var addressInfo = addresses[i];

            if (addressInfo.family === "IPv4" && !addressInfo.internal) {
                ipAddresses.push(addressInfo.address);
            }
        }
    }

    return ipAddresses;
};





wss.on("connection", function (ws) {
    console.log("A Web Socket connection has been established!");

    ws.on('message', function(data, flags) {
        console.log("received data");
        console.log(JSON.parse(data));
        var message = JSON.parse(data);
        if(message.type=="broadcastStream"){
            if(message.port > 0 && message.port < 65536) {
                portscanner.checkPortStatus(parseInt(message.port), '127.0.0.1', function(error, status) {
                 // Status is 'open' if currently in use or 'closed' if available 
                    if(error) {
                        //TO DO: send error back to user
                        console.log("ERROR: "+error);
                       //reak;
                    } else {
                        if(status=="closed"){
                            portscanner.findAPortNotInUse(8000, 9000, '127.0.0.1', function(error, port) {
                                console.log('AVAILABLE PORT AT: ' + port)
                                addSocketUDPConnection(port, parseInt(message.port), message.name);
                                ws.send(JSON.stringify({"type": "new channel", "port": port, "udpPort": message.port}));
                            });
                            //addUDPServer(message.port, ws, message.name);
                        } else {
                            console.log("other status");
                            console.log(status);
                        }
                    }
                });
            } else {
                console.log("not valid port");
            }
        }
  // flags.binary will be set if a binary data is received. 
  // flags.masked will be set if the data was masked. 
    });
});

//create a new socket<-->UDP connection
function addSocketUDPConnection(socketPort, udpPort, name){
    var socketServer = https.createServer(options).listen(socketPort);
    var socketChannel = new WebSocket.Server({
        server: socketServer
    });

    var udpChannel = new osc.UDPPort({
        localAddress: "127.0.0.1",
        localPort: udpPort   
    });

    udpChannel.on("ready", function () {
        var ipAddresses = getIPAddresses();
        console.log("Listening for OSC over UDP.");
        ipAddresses.forEach(function (address) {
            console.log(" Host:", address + ", Port:", udpChannel.options.localPort);
        });
    
      // ws.send("Receiving data OSC over UDP to" + udp.options.remoteAddress + ", Port:" + udp.options.remotePort);
    });

    udpChannel.on("osc", function(packet, info){
        console.log(packet);
    });
    udpChannel.open();

    socketChannel.on("connection", function(ws){
        console.log("new connection from "+ socketPort + " to " + udpPort);
        var socketOscPort = new osc.WebSocketPort({
            socket: ws
        });
       // ws.send("establishing handshake");
         var relay = new osc.Relay(udpChannel, socketOscPort, {
            raw: true
        });
    });
}

