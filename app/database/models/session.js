import mysql from "mysql";
import {connection} from "../database";

export async function readOne(sessionId) {
	let template = "SELECT * FROM sessions WHERE id=?";
	let data = [sessionId];
	let sql = mysql.format(template, data);
	return new Promise((resolve, reject) => {
		connection.query(sql, (error, results) => {
			if (error) reject(error);
			resolve(results[0]);
		});
	});
}