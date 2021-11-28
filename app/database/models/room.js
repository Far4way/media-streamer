import {connection} from "../database.js";
import mysql from "mysql";

let crypto;
try {
	crypto = await import("crypto");
} catch (err) {
	console.log("crypto support is disabled!");
}

export function createOne(userId, mediaId) {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(32, (err, buf) => {
			if (err) {
				console.log(err);
				return;
			}
			let template = "INSERT INTO room VALUES ( ?, ?, ?)";
			let roomId = buf.toString("hex");
			let data = [roomId, userId, mediaId];
			let sql = mysql.format(template, data);
			connection.query(sql, (error) => {
				if (error) reject(error);
				resolve(roomId);
			});
		});
	});
}

export async function readOne(roomId) {
	let template = "SELECT * FROM room WHERE id=?";
	let data = [roomId];
	let sql = mysql.format(template, data);
	return new Promise((resolve, reject) => {
		connection.query(sql, (error, results) => {
			if (error) reject(error);
			resolve(results[0]);
		});
	});
}

export async function updateChief(roomId, chiefId) {
	let template = "UPDATE room SET chief=? WHERE id=?";
	let data = [chiefId, roomId];
	let sql = mysql.format(template, data);
	return new Promise((resolve, reject) => {
		connection.query(sql, (error, result) => {
			if (error) reject(error);
			resolve(result);
		});
	});
}

export function deleteOne(roomId) {
	return new Promise((resolve, reject) => {
		let template = "DELETE FROM room WHERE id=? ";
		let data = [roomId];
		let sql = mysql.format(template, data);
		connection.query(sql, (error, result) => {
			if (error) reject(error);
			resolve(result);
		});
	});
}

export function clearAll() {
	return new Promise((resolve, reject) => {
		let template = "DELETE FROM room";
		let sql = mysql.format(template);
		connection.query(sql, (error, result) => {
			if (error) reject(error);
			resolve(result);
		});
	});
}