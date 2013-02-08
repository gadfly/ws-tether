/*
 * ws-tether | local-proxy
 * version 0.0.1
 * author: Takeharu.Oshida
 * https://github.com/georgeOsdDev/ws-tether
 */

var url       = require('url'),
    http      = require('http'),
    net       = require('net'),
    path      = require('path'),
    fs        = require('fs'),
    ws        = require("websocket.io"),
    args      = process.argv;

//var node = args[0];
//var path = args[1];
var port    = args[2],
    webSockets = {},
    clientList  = {};

var staticServer = http.createServer(function(req,res){
  var requestUrl = url.parse(req.url);
  if (requestUrl.host && requestUrl.hostname != "localhost"){
    if (webSockets.bridge) {
      doHttpProxy(req,res);
    } else {
      res.writeHead(500, {'Content-Type': 'text/html'});
      res.end("<html><body><p style='font-size:28px;'>bridge is not ready :(<p></body></html>");
    }
  }else{
    // for bridge.html
    var extname = path.extname(req.url),
        contentType = 'text/plain';
    switch (extname) {
      case '.html':
        contentType = 'text/html';
        break;
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      default:
        contentType = 'text/plain';
    }
    fs.readFile(__dirname + "/public" + requestUrl.path, function(err, data) {
      if(!err) {
        res.writeHead(200, {'Content-Type': contentType});
        res.end(data);
      } else {
        res.writeHead(404, {'Content-Type': 'text/html'});
        res.end("<html><body><p style='font-size:28px;'>404 Sorry :(<p></body></html>");
      }
    });
  }
}).listen(port,function(){
  console.log("start local proxy. PORT: "+port);
});
staticServer.on("connect",doHttpsProxy);

var server = ws.attach(staticServer);
server.on('connection', function (socket){
  console.log("conn");
  socket.on("message",function(message) {
    var data = JSON.parse(message);
    var res,statusCode,response,headers,body,buf;
    if (data.isInit){
      webSockets[data.name] = socket;
    }else if(data.isHttpRes && clientList[data.key]){
      res = clientList[data.key].res;
      statusCode = data.statusCode;
      headers = data.headers;
      res.writeHead(statusCode, headers);
      buf = new Buffer(data.response,"base64");
      res.end(buf);
    }else if(data.isHttpErr && clientList[data.key]){
      console.log("http err");
      res = clientList[data.key].res;
      res.writeHead(500, {'Content-Type': 'text/html'});
      res.end("<html><body><p style='font-size:28px;'>500 proxy server error :(<p></body></html>");
    }else if(data.isHttpsConnect && clientList[data.key]){
      console.log("https connect");
      clientList[data.key].socket.write('HTTP/1.1 200 Connection Established\r\n' +
                                  'Proxy-agent: Node-Proxy\r\n' +
                                  '\r\n');
    }else if(data.isHttpsData && clientList[data.key]){
      console.log("https data received");
      buf = new Buffer(data.dataStr,"base64");
      clientList[data.key].socket.write(buf);
    }else if(data.isHttpsEnd && clientList[data.key]){
      console.log("https end");
      clientList[data.key].socket.end();
    }
  });
  socket.on('close', function () {
    //console.log("closed");
  });
});

function doHttpProxy(req,res){
  var requestUrl,key,proxyRequest;
  requestUrl = url.parse(req.url);
  key = req.url +"_"+ (new Date().getMilliseconds());
  data = {
    "isHttpReq":true,
    "key":key,
    "requestUrl":requestUrl,
    "host":requestUrl.host.split(":")[0],
    "hostname":requestUrl.hostname,
    "port":requestUrl.port || 80,
    "path":requestUrl.path,
    "method":req.method || "GET",
    "headers":req.headers || "",
    "body":req.body || ""
  };
  clientList[key] = {
    "req":req,
    "res":res
  };
  webSockets.bridge.send(JSON.stringify(data));
}

function doHttpsProxy(req,clientSocket,head){
  var requestUrl,key,data;
  requestUrl = url.parse('https://' + req.url);
  key = req.url +"_"+ (new Date().getMilliseconds());
  data = {
    "isHttpsConnect":true,
    "key":key,
    "requestUrl":requestUrl,
    "head":head.toString("base64")
  };

  clientList[key] = {
    "req":req,
    "socket":clientSocket
  };
  webSockets.bridge.send(JSON.stringify(data));

  clientSocket.on("data",function(data){
    console.log("httpsdata send");
    var sendData = {
      "isHttpsData":true,
      "key":key,
      "dataStr":data.toString("base64")
    };
    webSockets.bridge.send(JSON.stringify(sendData));
  });
}
