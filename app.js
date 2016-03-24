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

/* Socket.io alkaa */

/* alustetaan Socket.io */
var SOCKET_LIST = {};
var io = require('socket.io')(serv,{});

/* tätä funktiota kutsutaan kun uusi client ottaa yhteyden serveriin */
io.sockets.on('connection', function(socket){
	console.log('Client yhdisti.'); 
	socket.id = Math.random(); //arvotaan clientille random id
	socket.x = 0; //alustetaan x ja y koordinaatit
	socket.y = 0;
	socket.number = "" + Math.floor(10 * Math.random()); //0-10 väliltä random numero, käytetään erottamaan "pelaajat" toisistaan
	SOCKET_LIST[socket.id] = socket; //lisätään arvottu id socket listaan
	
	/* tätä funktiota kutsutaan kun client katkaisee yhteyden */
	/* clientin ei tarvitse erikseen lähettää (emit) disconnect viestiä, vaan se tehdään automaattisesti */
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
	});
});

/* loopataan kaikki socketit läpi socket listasta (kutsutaan 25fps ~ 40ms välein) */
setInterval(function(){
	var pack = []; //paketti, joka lähetetään kaikille yhdistäneille clienteille, pitää sisällään tiedot KAIKISTA clienteistä
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.x++; //muutetaan kaikkien sijaintia
		socket.y++;
		pack.push({ //lisätään kaikkien sijainti pakettiin
			x:socket.x,
			y:socket.y,
			number:socket.number
		});
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack); //lähetetään viestinä paketti clienteille uusista sijainneista
	}
	

	
},1000/25);

/* Socket.io loppuu */