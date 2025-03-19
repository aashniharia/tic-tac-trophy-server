const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const app = express();
const { Server } = require("socket.io");

dotenv.config();

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://tic-tac-trophy.netlify.app/"],
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("createRoom", () => {
    const roomId = Math.random().toString(36).substring(7);
    rooms.set(roomId, {
      players: [socket.id],
      gameState: null,
      currentTurn: 1,
    });
    socket.join(roomId);
    socket.emit("roomCreated", { roomId, playerNumber: 1 });
  });

  socket.on("joinRoom", (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.players.length < 2) {
      room.players.push(socket.id);
      socket.join(roomId);
      socket.emit("roomJoined", { roomId, playerNumber: 2 });
      io.to(roomId).emit("gameStart");
    } else {
      socket.emit("roomError", "Room full or does not exist");
    }
  });

  socket.on("makeMove", ({ roomId, move }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.currentTurn = move.playerNumber === 1 ? 2 : 1;
      room.moveNumber = move.moveNumber;
      io.to(roomId).emit("moveMade", move);
    }
  });

  socket.on("restartGame", ({ roomId }) => {
    // console.log("RESTARTED");
    const room = rooms.get(roomId);
    if (room) {
      room.gameState = null;
      room.currentTurn = 1;
      room.moveNumber = -1;
      io.to(roomId).emit("gameRestarted");
    }
  });

  socket.on("disconnect", () => {
    rooms.forEach((value, key) => {
      if (value.players.includes(socket.id)) {
        io.to(key).emit("playerDisconnected");
        rooms.delete(key);
      }
    });
  });
});

server.listen(process.env.PORT, () => {
  console.log("listening on", process.env.PORT);
});
