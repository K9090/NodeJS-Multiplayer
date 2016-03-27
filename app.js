/* Express alkaa */
/* ainut paikka jossa Expressiä käytetään koko projektissa */
/* peli vaatii vain yhden webbi-sivun, joten enempää Expressiä ei tarvita */

/* luodaan serveri ja laitetaan se kuuntelemaan porttia 2000 */
/* kun porttiin 2000 tulee pyyntö, serverille kerrotaan siitä ja riippuen pyynnöstä tehdään jokin toiminto */
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res){
	res.sendFile(__dirname + '/client/index.html'); //tyhjä pyyntö -> lähetetään /client/index.html
});
app.use('/client',express.static(__dirname + '/client')); //pyyntö alkaa /client -> lähetetään pyydetty tiedosto /client kansiosta

/* client voi pyytää tiedostoja vain kahdesta yllä olevasta paikasta */
/* eli jos pyydetään esim. /server/secureFile.js -> ei tee yhtikäs mitään */

serv.listen(process.env.PORT || 2000); //kuunnellaan porttia 2000 localhostissa tai Herokun porttia (process.env.PORT)
console.log("Serveri startattu: kuuntelee porttia 2000.");
/* Express loppuu */


/* Luokat alkaa */
/* Entity luokka */
var Entity = function(){
	/* objekti (self), joka pitää sisällään attribuutit */
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
	}
	/* objektin metodit */
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
	}
	return self; //konstruktori palauttaa objektin (self)
}

/* Pelaaja luokka */
var Player = function(id){
	var self = Entity(); //luokka peritään Entitystä
	/* lisätään Entityn attribuuttien lisäksi pelaajalle omia attribuutteja */
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.maxSpd = 10;
	
	var super_update = self.update; //otetaan alkuperäinen Entityn update-funktio talteen muuttujaan (super_update)
	self.update = function(){ //ylikirjoitetaan update-funktio
		self.updateSpd(); //päivitetään pelaajan nopeus
		super_update(); //kutsutaan alkuperäistä Entityn update-funktiota, joka päivittää sijainnin nopeuden perusteella
	}
	
	/* muutetaan pelaajan nopeutta sen mukaan, mitä näppäintä painetaan */
	self.updateSpd = function(){
		/* x-suunnassa */
		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;
		/* y-suunnassa */
		if (self.pressingUp)
			self.spdY = -self.maxSpd;
		else if (self.pressingDown)
			self.spdY = self.maxSpd;
		else 
			self.spdY = 0;
	}
	Player.list[id] = self; //lisätään pelaaja listaan luonnin yhteydessä
	return self;
}

/* lista kaikista pelaajista, HUOM! STAATTINEN (vain yksi lista pelaajista on olemassa) */
Player.list = {};

/* staattisia Pelaaja-luokan funktioita */
/* tätä funktiota kutsutaan, kun uusi client ottaa yhteyden serveriin */
Player.onConnect = function(socket){
	var player = Player(socket.id); //luodaan uusi pelaaja
	
	/* tätä funktiota kutsutaan, kun client lähettää viestin näppäimen painamisesta */
	/* viestin data-osassa tulee mukana painetun näppäimen id, sekä tieto siitä, onko näppäin painettu alas vai ylös */
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});
}

/* tätä funktiota kutsutaan, kun client katkaisee yhteyden */
Player.onDisconnect = function(socket){
	delete Player.list[socket.id]; //poistetaan pelaaja listalta
}

/* update funktio, kutsutaan ~18ms välein */
Player.update = function(){
	var pack = []; //paketti, joka pitää sisällään tiedot kaikista pelaajista
	for(var i in Player.list){
		var player = Player.list[i];
		player.update(); //päivitetään pelaajan sijainti
		pack.push({ //lisätään sijainti pakettiin
			x:player.x,
			y:player.y,
			number:player.number
		});
	}
	return pack;
}
/* Luokat loppuu */


/* Socket.io alkaa */
/* alustetaan Socket.io */
var io = require('socket.io')(serv,{});

/* Lista kaikista socketeista */
var SOCKET_LIST = {};

/* tätä funktiota kutsutaan, kun uusi client ottaa yhteyden serveriin */
io.sockets.on('connection', function(socket){
	console.log('Client yhdisti.'); 
	socket.id = Math.random(); //arvotaan clientille random id
	SOCKET_LIST[socket.id] = socket; //lisätään arvottu id socket-listaan
	Player.onConnect(socket); //kutsutaan Player-luokan funktiota (onConnect), joka luo uuden pelaajan
	
	/* tätä funktiota kutsutaan, kun client katkaisee yhteyden */
	/* clientin ei tarvitse erikseen lähettää (emit) disconnect-viestiä, vaan se tehdään automaattisesti */
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id]; //poistetaan disconnectannut clientti listoilta
		Player.onDisconnect(socket);
	});
});

/* loopataan läpi kaikki clientit (kutsutaan 60fps ~ 18ms välein) */
setInterval(function(){
	var pack = Player.update(); //päivitetään kaikkien pelaajien sijainnit pakettiin
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack); //lähetetään viestinä paketti kaikille clienteille uusista sijainneista
	}	
},1000/60);
/* Socket.io loppuu */