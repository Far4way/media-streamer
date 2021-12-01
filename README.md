# media-streamer
Personnal project to watch medias with multiple users, allow uploading of medias. Chat and synchronisation features.
Available for testing at: https://modulab.tech/video-streamer/

https://modulab.tech is also hosting another project, a simple blog for news article.

## Setting-up the system

### 0. Usage

Once the whole project is correctly setup, you just need to make sure you have all the modules installed using ```npm install``` in the root directory of the project, and you can then start the server using ```node index.js```.

Then, access the server using `localhost`, or the corresponding domain name/ip on your favorite browser. Make yourself an account, and you can now upload files and create rooms to visualize them with other users by simply sharing the link.

Do note that, refreshing the page will kick you out of the room if there is no other user connected, or transfer the ownership of the room (if you had it), to another user.

### 1. Installing nvm, node and npm

First, make sure to `sudo apt update && sudo apt upgrade` to get all the last updates.

You then need to install nvm, which will handle the versionning and setup of node and npm:

```curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash```

The following command should now return 'nvm': 

`command -v nvm`

Now comes the installation of node/npm, we recommend using the Latest stable version, but you can list all availables using the command: 

`nvm list availables`

And then install the version you want with : `nvm install v16.13.0`

You can then check node and npm versions : `node -v && npm --version`

Npm might need an update: `npm install-latest-npm`

### 2. Setting Up The Environment Variables (dotenv module)

You can find in this repository a file named ```.env.example```, this file is a template for your own ```.env``` that you will have to create and populate, following the template. You need to fill in the many variables such as the hostsname, ports, database credentials, and paths to your certificate files to implement TLS. 

### 3. Preparations for HTTPS, creating your certificate

You can use services like LetsEncrypt, or any Trusted Certificate Authority ; or you can use a self-signed certificate. This last one will allow you to work with https, while your browser may say he doesn't recognise the certificate, or trust it.

You can self-sign using openssl, using a command following this one:

```openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365```

You will be asked some informations, remember that to run the server locally, you might want to specify `localhost` as for the domain name, or the ip address of the server in your local network, or if you have a distant server, specify its ip instead.

You will then need to edit the ```.env``` file, to the path of the generated files.

You might encounter some trouble concerning access permission on the files generated, depending on the folder they are put in (especially with LetsEncrypt). In this case you can either move the files in an user directory, or run your server with the ```sudo``` keyword in development.

### 4. Setting Up the Database (Mysql)

The project is made to work with a mysql database. You will first need to create your Schema, with the name you see fit, and specify it in the ```.env``` file.
Then to create the tables needed, you can enter the following queries :

"user" table:
```
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(512) NOT NULL,
  `username` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```
"media" table:
```
CREATE TABLE `media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `path` varchar(255) NOT NULL,
  `title` varchar(100) NOT NULL,
  `uploader` int NOT NULL,
  `type` varchar(45) NOT NULL,
  `subtype` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `path_UNIQUE` (`path`),
  KEY `fk_media_user_idx` (`uploader`),
  CONSTRAINT `fk_media_user` FOREIGN KEY (`uploader`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```
"room" table:
```
CREATE TABLE `room` (
  `id` char(64) NOT NULL,
  `chief` int NOT NULL,
  `media` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_room_media_idx` (`media`),
  KEY `fk_room_user_idx` (`chief`),
  CONSTRAINT `fk_room_media` FOREIGN KEY (`media`) REFERENCES `media` (`id`),
  CONSTRAINT `fk_room_user` FOREIGN KEY (`chief`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```
"sessions" table:
```
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

### 6. Troubleshooting

Depending on the privileges the user you start node with has, you night encounter problems accessing files or even directories. In that case, for a short term resolution (not recommended) you can simply grant access of read/write/execution to the current user, or a specific group where you put the user a node user.

You may encounter the following error: ```413 Request Entity Too Large```. This means that the file you are trying to upload is deemed too large. 
If you are running the node server behind nginx or another proxy, you will first want to check on this side. If there is no problem there, you will want to configure the maximum file size authorized in the media uploading form. This is available in the file ```index.js```, in the block corresponding to the post route "/api/upload", there you will see an option to reduce or extend the accepted maximum size of file. 
