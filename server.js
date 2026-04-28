const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
  res.send('<h1>Acetime Server is Running!</h1>');
});

io.on('connection', (socket) => {
  console.log('A user connected: ' + socket.id);
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});