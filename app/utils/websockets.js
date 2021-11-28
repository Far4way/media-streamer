import {Server} from "socket.io";
import sharedSession from "express-socket.io-session";
import cookieparser from "cookie-parser";
import * as User from "../database/models/user.js";
import * as Room from "../database/models/room.js";

let socketSession = new Map();

let io;

export function socketConnection(server, session, sessionStore, roomsInfos) {
	
	io = new Server(server, { /* options */});
	io.use(sharedSession(session, cookieparser(), {
		autoSave: true,
	}));
	
	io.on("connection", (socket) => {
		console.log("Socket " + socket.id + " connected.");
		let url = (socket.request.headers.referer);
		if (!socket.handshake.session.user) return;
		let host = process.env.HOST;
		let regex = "https:\\/\\/" + host + "(:[0-9]{2,5})?\\/room\\/([a-zA-Z0-9]{64})";
		
		function isChief(socket, roomId) {
			return new Promise((resolve, reject) => {
				sessionStore.get(socketSession.get(socket.id), (error, sess) => {
					if (error) reject(error);
					if (sess && sess.chief) resolve(sess.chief.includes(roomId));
					resolve(false);
				});
			});
		}
		
		function sendSyncMessage(socket, roomId, key, syncValue) {
			//TODO : Mode Anarchy
			if (roomId === (url.split("/").pop())) {
				isChief(socket, roomId).then((res) => {
					if (res) {
						socket.to(roomId).emit(key, syncValue);
					} else {
					}
				});
			}
			
		}
		
		if (url.match(regex)) {//room connected
			socket.on("hello", (roomId) => {
				let roomSet = io.of("/").adapter.rooms.get(roomId);
				if (!roomSet || !roomSet.has(socket.id)) {
					socket.join(roomId);
				}
				socketSession.set(socket.id, socket.handshake.session.id);
				socket.rooms.forEach((value => {
					if (value !== socket.id) {
						let roomInfo = roomsInfos.get(roomId);
						if (!roomInfo) return;
						roomInfo["users"].add(socket.handshake.session.user.username);
						roomsInfos.set(roomId, roomInfo);
						let infoR = {chief: roomInfo["chief"], users: Array.from(roomInfo["users"])};
						socket.to(roomId).emit("roomInfos", infoR);
						socket.emit("roomInfos", infoR);
					}
				}));
			});
			
			socket.on("sync", (roomId, syncValue, paused) => {
				sendSyncMessage(socket, roomId, paused ? "pause" : "play", syncValue);
			});
			socket.on("play", (roomId, syncValue) => {
				sendSyncMessage(socket, roomId, "play", syncValue);
			});
			socket.on("seek", (roomId, syncValue) => {
				sendSyncMessage(socket, roomId, "seek", syncValue);
			});
			socket.on("pause", (roomId, syncValue) => {
				sendSyncMessage(socket, roomId, "pause", syncValue);
			});
			socket.on("chatMessage", (roomId, message) => {
				let username = socket.handshake.session.user.username;
				sendMessage(roomId, "chatMessage", [username, message]);
			});
			
			socket.on("disconnecting", (reason) => {
				socket.rooms.forEach((value => {
					if (value !== socket.id) {
						let roomId = value;
						if (!roomsInfos.get(roomId)) return;
						let roomInfo = roomsInfos.get(roomId);
						roomInfo["users"].delete(socket.handshake.session.user.username);
						roomsInfos.set(roomId, roomInfo);
						
						isChief(socket, roomId).then((res) => {
							if (res) {
								socketSession.delete(socket.id);
								let chief = socket.handshake.session.chief;
								if (chief) {
									let index = chief.indexOf(roomId);
									if (index > -1) chief.splice(index, 1);
									socket.handshake.session.chief = chief;
									socket.handshake.session.save();
								}
								let socketsInRoom = io.of("/").adapter.rooms.get(roomId);
								if (socketsInRoom && socketsInRoom.size >= 1) {
									let elem = socketsInRoom.values().next().value;
									
									if (socketSession.get(elem)) {
										sessionStore.get(socketSession.get(elem), (error, sess) => {
											if (error) console.log(error);
											if (!sess.chief) sess.chief = [];
											sess.chief.push(roomId);
											sessionStore.set(socketSession.get(elem), sess, (err) => {
												if (err) console.log(err);
												roomInfo["chief"] = sess.user.username;
												roomsInfos.set(roomId, roomInfo);
												let infoR = {
													chief: roomInfo["chief"],
													users: Array.from(roomInfo["users"]),
												};
												sendMessage(roomId, "roomInfos", infoR);
												User.readOneByUsername(sess.user.username).then((user) => {
													Room.updateChief(roomId, user.id).then();
												});
												
											});
										});
									}
								} else {
									roomsInfos.delete(roomId);
									Room.deleteOne(roomId).then();
								}
							} else { // the user isn't the room chief
								socketSession.delete(socket.id);
								let infoR = {chief: roomInfo["chief"], users: Array.from(roomInfo["users"])};
								sendMessage(roomId, "roomInfos", infoR);
							}
						});
						
					}
				}));
			});
		}
		
	});
	return io;
}

function sendMessage(roomId, key, message) {
	console.log("sending message : ");
	console.log(message);
	io.to(roomId).emit(key, message);
}

function getRooms() {
	return io.sockets.adapter.rooms;
}