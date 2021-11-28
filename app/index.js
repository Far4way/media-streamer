import path from "path";
import express from "express";
import formidable from "formidable";
import fs from "fs";
import handlebars from "express-handlebars";
import session from "express-session";
import MySQLStore from "express-mysql-session";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import * as Media from "./database/models/media.js";
import * as User from "./database/models/user.js";
import * as Room from "./database/models/room.js";
import * as Http from "http";
import * as Https from "https";
import * as ws from "./utils/websockets.js";

const __dirname = path.resolve();

const options = {
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_SCHEMA,
};
const sessionStore = new MySQLStore(options);

let roomsInfos = new Map();

const app = express();
const httpPort = process.env.HTTP_PORT;
const securePort = process.env.HTTPS_PORT;

const secureServer = Https.createServer({
	key: fs.readFileSync(process.env.KEY_PATH),
	cert: fs.readFileSync(process.env.CERTIFICATE_PATH),
}, app);

let sessionObj = session({
	secret: "Secret que seul Chuck Norris lui seul knows.",
	resave: true,
	store: sessionStore,
	saveUninitialized: true,
	cookie: {secure: false, httpOnly: false, maxAge: 1000 * 60 * 60 * 24}, // 1 day expiration
});
app.use(sessionObj);

let io = ws.socketConnection(secureServer, sessionObj, sessionStore, roomsInfos);
app.use(function(req, res, next) {
	req.io = io;
	next();
});

app.set("json spaces", 2);
app.set("view engine", "handlebars");

app.engine("handlebars", handlebars({
	layoutsDir: __dirname + "/views/layouts",
	partialsDir: __dirname + "/views/partials/",
	helpers: {
		ifCond: function(v1, v2, options) {
			if (v1 === v2) {
				return options.fn(this);
			}
			return options.inverse(this);
		},
	},
}));

let urlencodedParser = bodyParser.urlencoded({extended: false});

app.use(express.static(__dirname + "/public/video-streamer/"));

app.get("/private/*", (req, res, next) => {
	if (req.session && req.session.user && req.session.user.loggedIn) {
		app.use("/private", express.static(__dirname + "/private/"));
		next();
	} else {
		res.redirect("/login");
	}
});

app.get("/", (req, res) => {
	Media.readAll((error, results) => {
		if (error) {
			console.log(error);
			res.status(500);
			res.redirect("/");
		}
		let medias = {
			formats: [],
			medias: [],
		};
		results.forEach(media => {
			if (!medias.formats.includes(media.type)) {
				medias.formats.push(media.type);
			}
			medias["medias"].push({id: media.id, title: media.title, type: media.type});
		});
		medias["medias"].sort((a, b) => {
			if (a.title < b.title) {
				return -1;
			}
			if (a.title > b.title) {
				return 1;
			}
			return 0;
		});
		res.render("main", {layout: "index", user: req.session.user, medias: medias});
	});
});

app.get("/register", (req, res) => {
	res.render("register", {layout: "index", user: req.session.user});
});

app.get("/login", (req, res) => {
	res.render("login", {layout: "index", user: req.session.user});
});

app.get("/logout", (req, res) => {
	req.session.destroy();
	res.redirect("/");
});

app.get("/room/:roomId", (req, res) => {
	let url = req.protocol + "://" + req.hostname + req.originalUrl;
	let regex = "https:\\/\\/" + req.hostname + "\\/room\\/([a-zA-Z0-9]{64})";
	if (url.match(regex)) {
		let roomId = req.originalUrl.split("/")[2];
		if (!roomId) {
			res.redirect("/");
			return;
		}
		Room.readOne(roomId).then((room) => {
			if (!room) {
				res.redirect("/");
				return;
			}
			Media.readOne(room.media).then((media) => {
				res.render("room", {
					layout: "index",
					user: req.session.user,
					room: {id: room.id},
					media: {title: media.title, type: media.type, subtype: media.subtype, path: media.path},
				});
			});
		});
	} else
		res.redirect("/");
});

app.post("/login", urlencodedParser, async(req, res) => {
	let email = req.body.email;
	let password = req.body.password;
	let data = {};
	data["email"] = email;
	let valid = true;
	User.readOne(email).then(user => {
		if (!user) {
			data["emailError"] = "Unknown email, please register first";
			valid = false;
		} else {
			bcrypt.compare(password, user.password).then((result) => {
				if (!result) {
					data["passwordError"] = "Incorrect Password";
					valid = false;
				} else {
					req.session.user = {loggedIn: true, username: user.username};
					console.log("User " + user.username + " connected.");
					res.redirect("/");
				}
			});
		}
		if (!valid) {
			let params = new URLSearchParams(data).toString();
			res.redirect("/login?" + params);
		}
	}).catch((err) => {
		console.log(err);
	});
});

app.post("/register", urlencodedParser, async(req, res) => {
	let username = req.body.username;
	let email = req.body.email;
	let password = req.body.password;
	let data = {};
	let valid = true;
	if (await User.existingUsername(username)) {
		data["usernameError"] = "Username already in use";
		valid = false;
	}
	if (await User.existingEmail(email)) {
		data["emailError"] = "Email already registered";
		valid = false;
	}
	data["email"] = email;
	data["username"] = username;
	let params = new URLSearchParams(data).toString();
	
	if (valid) {
		let salt = bcrypt.genSaltSync(10);
		if (!salt) {
			res.redirect("/register?" + params);
			return;
		}
		let hash = bcrypt.hashSync(password, salt).toString();
		if (!hash) {
			res.redirect("/register?" + params);
			return;
		}
		User.createOne({email: email, password: hash, username: username}, (err) => {
			if (err) console.log(err);
			res.redirect("/login");
		});
	} else {
		res.redirect("/register?" + params);
	}
});

app.post("/api/create-room", urlencodedParser, (req, res) => {
	let mediaId = req.body.media;
	if (req.session && req.session.user && req.session.user.loggedIn) {
		User.readOneByUsername(req.session.user.username).then((user) => {
			if (!user) {
				res.redirect("/");
			}
			Room.createOne(user.id, mediaId).then((roomId) => {
				if (roomId) {
					req.session.chief = [];
					req.session.chief.push(roomId);
					roomsInfos.set(roomId, {users: new Set(), chief: user.username});
					res.redirect("/room/" + roomId);
				}
			}).catch((err) => {
				console.log(err);
				res.redirect("/");
			});
		});
	}
});

app.post("/api/upload", (req, res) => {
	const form = formidable({multiples: true, maxFileSize: 200 * 1024 * 1024});
	let data = {};
	let valid = true;
	form.parse(req, (err, fields, files) => {
		if (err) {
			res.status(500);
			res.end();
			return;
		}
		if (!files["uploadedFile"]) {
			data["fileError"] = "File required";
			valid = false;
		}
		if (fields["title"] === "") {
			data["titleError"] = "Title required";
			valid = false;
		}
		let mimetype = files["uploadedFile"]["mimetype"].toString().split("/");
		if (!mimetype || !mimetype[0] || !mimetype[1]) {
			data["uploadError"] = "Uploaded file is not readable";
			valid = false;
		}
		let type = mimetype[0];
		let subtype = mimetype[1];
		let TYPES = JSON.parse(fs.readFileSync("types.json", "utf8"));
		if (!TYPES[type] || !TYPES[type].includes(subtype)) {
			data["uploadError"] = "Uploaded file is not compatible";
			valid = false;
		}
		let oldPath = files["uploadedFile"].filepath;
		let extension = subtype === "plain" ? "txt" : subtype;
		let newPath = __dirname + "/private/medias/" + type + "/" + fields["title"] + "." + extension;
		if (!valid) {
			let params = new URLSearchParams(data).toString();
			res.redirect("/?" + params);
		} else {
			try {
				fs.rename(oldPath, newPath, (err) => {
					if (err) {
						console.log(err);
						res.status(500);
						res.redirect("/");
						return;
					}
					User.readOneByUsername(req.session.user.username).then((user) => {
						if (!user) {
							fs.unlinkSync(newPath);
							res.status(500);
							res.redirect("/");
							return;
						}
						Media.createOne({
							path: "/private/medias/" + type + "/" + fields["title"] + "." + extension,
							title: fields["title"],
							uploader: user.id,
							type: type,
							subtype: subtype,
						}, (error) => {
							if (error) {
								console.log(error);
								fs.unlinkSync(newPath);
								res.status(500);
								res.redirect("/");
								return;
							}
							console.log("Media created by user " + user.username);
							res.status(200);
							res.redirect("/");
						});
					});
				});
			} catch (error) {
				console.log("File Management error : " + error);
			}
		}
		
	});
});

secureServer.listen(securePort, process.env.HOST, () => {
	console.log("Https listening on port " + securePort + " ...");
});

Http.createServer((req, res) => {
	console.log(req);
	res.writeHead(308, {
		"Location": "https://" + process.env.HOST + req.url,
	});
	res.end();
}).listen(httpPort, process.env.HOST, () => {
	console.log("Http server listening on port " + httpPort + " ...");
});