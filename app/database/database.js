import mysql from "mysql";
import * as Room from "./models/room.js";
import dotenv from "dotenv";

dotenv.config();

export const connection = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	port: process.env.DB_PORT,
	password: process.env.DB_PASS,
	database: process.env.DB_SCHEMA,
});

connection.connect(function(err) {
	if (err) throw err;
	console.log("Connexion to the Mysql database successfully established.");
	Room.clearAll().then();
});
