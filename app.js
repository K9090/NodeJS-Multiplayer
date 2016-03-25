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

serv.listen(process.env.PORT || 2000); //kuunnellaan porttia 2000 localhostissa, process.env.PORT == Heroku portti
console.log("Serveri startattu: kuuntelee porttia 2000.");
/* Express loppuu */

/* Lista kaikista socketeista ja pelaajista */
var SOCKET_LIST = {};
var PLAYER_LIST = {};

/* Pelaaja luokka */
var Player = function(id){
	var self = {
		x:250, //alustetaan x ja y koordinaatit
		y:250,
		id:id,
		number:"" + Math.floor(10 * Math.random()), //0-10 väliltä random numero, käytetään erottamaan "pelaajat" toisistaan
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,
		maxSpd:10,
	}
	self.updatePosition = function(){
		if(self.pressingRight)
			self.x += self.maxSpd;
		if(self.pressingLeft)
			self.x -= self.maxSpd;
		if(self.pressingUp)
			self.y -= self.maxSpd;	
		if(self.pressingDown)
			self.y += self.maxSpd;	
	}
	return self;
}

/* Socket.io alkaa */
/* alustetaan Socket.io */
var io = require('socket.io')(serv,{});

/* tätä funktiota kutsutaan kun uusi client ottaa yhteyden serveriin */
io.sockets.on('connection', function(socket){
	console.log('Client yhdisti.'); 
	socket.id = Math.random(); //arvotaan clientille random id
	SOCKET_LIST[socket.id] = socket; //lisätään arvottu id socket listaan
	
	var player = Player(socket.id); //luodaan uusi pelaaja, annetaan parametrina arvottu id
	PLAYER_LIST[socket.id] = player; //lisätään pelaaja listaan
	
	/* tätä funktiota kutsutaan kun client katkaisee yhteyden */
	/* clientin ei tarvitse erikseen lähettää (emit) disconnect viestiä, vaan se tehdään automaattisesti */
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id]; //poistetaan disconnectannut clientti socket ja player listoista
		delete PLAYER_LIST[socket.id];
	});
	
	/* tätä funktiota kutsutaan kun client lähettää viestin näppäimen painamisesta */
	/* viestin data-osassa tulee mukana painetun näppäimen Id, sekä tieto onko näppäin painettu alas vai ylös */
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
});

/* loopataan kaikki socketit läpi socket listasta (kutsutaan 25fps ~ 40ms välein) */
setInterval(function(){
	var pack = []; //paketti, joka lähetetään kaikille yhdistäneille clienteille, pitää sisällään tiedot KAIKISTA clienteistä
	for(var i in PLAYER_LIST){
		var player = PLAYER_LIST[i];
		player.updatePosition();
		pack.push({ //lisätään kaikkien sijainti pakettiin
			x:player.x,
			y:player.y,
			number:player.number
		});
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack); //lähetetään viestinä paketti clienteille uusista sijainneista
	}
	

	
},1000/25);

/* Socket.io loppuu */