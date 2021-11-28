import {connection} from "../database.js";
import mysql from "mysql";

export function createOne({email, password, username}, callback) {
	let template = "INSERT INTO user VALUES ( DEFAULT, ?, ?, ?)";
	let data = [email, password, username];
	let sql = mysql.format(template, data);
	connection.query(sql, callback);
}

export async function readOne(email) {
	let template = "SELECT * FROM user WHERE email=?";
	let data = [email];
	let sql = mysql.format(template, data);
	return new Promise((resolve, reject) => {
		connection.query(sql, (error, results) => {
			if (error) reject(error);
			resolve(results[0]);
		});
	});
}

export async function readOneByUsername(username) {
	let template = "SELECT * FROM user WHERE username=?";
	let data = [username];
	let sql = mysql.format(template, data);
	return new Promise((resolve, reject) => {
		connection.query(sql, (error, results) => {
			if (error) reject(error);
			resolve(results[0]);
		});
	});
}

export async function existingUsername(username) {
	let template = "SELECT * FROM user WHERE username=?";
	let data = [username];
	let sql = mysql.format(template, data);
	return new Promise((resolve, reject) => {
		connection.query(sql, (error, results) => {
			if (error) reject(error);
			if (results[0]) {
				resolve(true);
			} else resolve(false);
		});
	});
}

export async function existingEmail(email) {
	let template = "SELECT * FROM user WHERE email=?";
	let data = [email];
	let sql = mysql.format(template, data);
	return new Promise((resolve, reject) => {
		connection.query(sql, (error, results) => {
			if (error) reject(error);
			if (results[0]) {
				resolve(true);
			} else resolve(false);
		});
	});
}