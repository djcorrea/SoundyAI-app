import http from "http";

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
}).listen(process.env.PORT || 8080);
