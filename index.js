var express = require("express");
const http = require("http");
var app = express();
const server = http.createServer(app);

const formatMessage = require("./utils/messages");
const {
  userJoin,
  getCurrentUser,
  userLeave,
  addUserCandidate,
  getUserCandidates,
} = require("./utils/users");

const {
  getRoom,
  userJoinRoom,
  userLeaveRoom,
  getGuestId,
  getOwnerId,
} = require("./utils/rooms");

const socketIo = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

socketIo.on("connection", (socket) => {
  console.log("New client connected: " + socket.id);

  // VIDEO STREAM
  socket.on("joinRoom", ({ roomKey, isOwner }) => {
    userJoin(socket.id);
    console.log("user join room", socket.id + " " + isOwner);
    socket.join(roomKey);
    const roomAfterJoin = userJoinRoom(roomKey, socket.id, isOwner);
    console.log("roomAfterJoin ", roomAfterJoin);

    if (roomAfterJoin.online === 2) {
      console.log("send ownerStart", { id: socket.id, isOwner });
      if (isOwner) {
        // send signal to ownerUser to start the connection
        socket.emit("ownerStart", "message");
      } else {
        // send to other - owner
        socket.to(roomKey).emit("ownerStart", "message");
      }

      // send log - can remove
      socket.emit("message", "Two user joined in the room");
      socket.to(roomKey).emit("message", "Two user joined in the room");
    }
  });

  socket.on("upOffer", function ({ roomKey, offer }) {
    console.log("upOffer ", { userID: socket.id });
    socket.join(roomKey);
    // only send to OTHER people in room
    socket.to(roomKey).emit("downOffer", offer);
  });

  socket.on("updateCandidate", function ({ roomKey, candidate }) {
    console.log("updateCandidate", socket.id);
    socket.join(roomKey);
    //save to user info in case: send to user when remoteDescription is unset
    addUserCandidate(socket.id, candidate);
    // only send to other person in the room
    socket.to(roomKey).emit("otherUpdateCandidate", candidate);
  });

  socket.on("getOtherCandidates", function ({ isOwner, roomKey }) {
    let candidates;
    if (isOwner) {
      const guestId = getGuestId(roomKey);
      candidates = getUserCandidates(guestId);
    } else {
      const ownerId = getOwnerId(roomKey);
      candidates = getUserCandidates(ownerId);
    }
    socket.emit("downOtherCandidates", candidates);

    const guestId = getGuestId(roomKey);
    const guestcandidates = getUserCandidates(guestId);
    const ownerId = getOwnerId(roomKey);
    const ownercandidates = getUserCandidates(ownerId);

    console.log("getRoomCandidates", {
      guestcandidates: guestcandidates.length,
      ownercandidates: ownercandidates.length,
    });
  });

  socket.on("disconnect", () => {
    const currentUser = getCurrentUser(socket.id);
    console.log("Client disconnected", currentUser);
    if (currentUser) {
      userLeaveRoom(socket.id);
      userLeave(socket.id);
    }
  });

  // MESSAGES
  socket.on("sendOtherMessage", function ({ roomKey, message }) {
    console.log("sendOtherMessage", { roomKey, message });
    socket.join(roomKey);
    socket.to(roomKey).emit("getOtherMessage", { message });
  });
});
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
