import {connection} from "../database.js";
import mysql from "mysql";

export function createOne({path, title, uploader, type, subtype}, callback) {
	let template = "INSERT INTO media VALUES ( DEFAULT, ?, ?, ?,?,?)";
	let data = [path, title, uploader, type, subtype];
	let sql = mysql.format(template, data);
	connection.query(sql, callback);
}

export function readAll(callback) {
	let sql = "SELECT * FROM media";
	connection.query(sql, callback);
}

export async function readOne(mediaId) {
	let template = "SELECT * FROM media WHERE id=?";
	let data = [mediaId];
	let sql = mysql.format(template, data);
	return new Promise((resolve, reject) => {
		connection.query(sql, (error, results) => {
			if (error) reject(error);
			resolve(results[0]);
		});
	});
}