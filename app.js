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
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2)); //laskee etäisyyden Entityn ja parametrina annetun pisteen välillä
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
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;
	
	var super_update = self.update; //otetaan alkuperäinen Entityn update-funktio talteen muuttujaan (super_update)
	self.update = function(){ //ylikirjoitetaan update-funktio
		self.updateSpd(); //päivitetään pelaajan nopeus
		super_update(); //kutsutaan alkuperäistä Entityn update-funktiota, joka päivittää sijainnin nopeuden perusteella
		
		/* ammutaan bulletteja, kun hiiren painike on alaalla */
		if(self.pressingAttack){
			self.shootBullet(self.mouseAngle);
		}
		self.shootBullet = function(angle){
			var b = Bullet(self.id,angle);
			b.x = self.x; //bullet luodaan pelaajan sijaintiin
			b.y = self.y;
		}
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

/* lista kaikista pelaajista, HUOM! STAATTINEN (vain yksi lista pelaajista on olemassa, yhteinen kaikille Pelaaja-luokan olioille) */
Player.list = {};

/* kaikki loput funktiot ovat staattisia Pelaaja-luokan funktioita (= yhteisiä kaikille Pelaaja-luokan olioille) */

/* tätä funktiota kutsutaan, kun uusi client ottaa yhteyden serveriin */
Player.onConnect = function(socket){
	var player = Player(socket.id); //luodaan uusi pelaaja
	
	/* tätä funktiota kutsutaan, kun client lähettää viestin inputista */
	socket.on('keyPress',function(data){
		/* näppäimistön näppäintä painetaan */
		/* viestin data-osassa tulee mukana painetun näppäimen id, sekä tieto siitä, onko näppäin painettu alas vai ylös */
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		
		/* hiiren painiketta painetaan, datana tulee tieto siitä, onko painettu alas vai ylös */
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		/* hiirtä liikutetaan, datana tulee hiiren kulma */
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
}

/* tätä funktiota kutsutaan, kun client katkaisee yhteyden */
Player.onDisconnect = function(socket){
	delete Player.list[socket.id]; //poistetaan pelaaja listalta
}

/* update funktio, joka päivittää kaikki pelaajat, kutsutaan 60fps ~ 18ms välein */
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

/* Bullet luokka */
var Bullet = function(parent,angle){
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI) * 10;
	self.spdY = Math.sin(angle/180*Math.PI) * 10;
	self.parent = parent; //bulletin omistaja, eli kuka pelaaja ampui bulletin
	self.timer = 0;
	self.toRemove = false;

	var super_update = self.update; //samat update-kikkailut, mitkä tehtiin Pelaaja-luokassa
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true; //poistetaan bulletti tietyn ajan kuluttua
		super_update();

		/* törmäykset */
		/* loopataan läpi kaikki pelaajat ja tarkistetaan, onko etäisyys alle 32 && ettei kyseinen pelaaja omista bullettia */
		/* jos nämä ehdot toteutuvat -> törmäys */
		for (var i in Player.list) {
			var p = Player.list[i];
			if(self.getDistance(p) < 32 && self.parent !== p.id){ 
				//tähän tulee joskus törmäykseen liittyvää toiminnallisuuta, esim. vähennetään terveyspisteitä pelaajalta (hp--;)
				self.toRemove = true;
			}
		}
	}
	Bullet.list[self.id] = self; //lisätään bulletti listaan luonnin yhteydessä
	return self;
}

/* lista kaikista bulleteista, HUOM! STAATTINEN (vain yksi lista bulleteista on olemassa, yhteinen kaikille Bullet-luokan olioille) */
Bullet.list = {};

/* staattinen update funktio, joka päivittää kaikki bulletit, kutsutaan 60fps ~ 18ms välein (samanlainen kuin Pelaaja-luokalla) */
Bullet.update = function(){
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove)
			delete Bullet.list[i]; //poistetaan bullet jos toRemove-flagi on true
		else
			pack.push({
				x:bullet.x,
				y:bullet.y,
			});
	}
	return pack;
}
/* Luokat loppuu */


/* Socket.io alkaa */
/* alustetaan Socket.io */
var io = require('socket.io')(serv,{});

/* lista kaikista socketeista */
var SOCKET_LIST = {};

/* debug-mode, sallii komentojen lähettämisen */
var DEBUG = true; //vaihdetaan falseksi release-versiossa!

/* objekti kaikista valideista käyttäjä+salasana -pareista*/
var USERS = {
	//username:password
	"root":"root66",
	"testi":"sala",
	"demo":"demo",
}

/* simuloidaan oikean tietokannan viivettä setTimeouteilla -> täytyy käyttää callbackejä */
var isValidPassword = function(data,cb){
	setTimeout(function(){
		cb(USERS[data.username] === data.password); //tarkistetaan, löytyykö USERS-objektista datana tullutta käyttäjä+salasana -paria
	},10);
}
var isUsernameTaken = function(data,cb){
	setTimeout(function(){
		cb(USERS[data.username]); //palauttaa true, jos käyttäjä löytyy jo
	},10);
}
var addUser = function(data,cb){
	setTimeout(function(){
		USERS[data.username] = data.password; //lisätään uusi käyttäjä+salasana -pari
		cb();
	},10);
}

/* tätä funktiota kutsutaan, kun uusi client ottaa yhteyden serveriin */
io.sockets.on('connection', function(socket){
	console.log('Client yhdisti.'); 
	socket.id = Math.random(); //arvotaan clientille random id
	SOCKET_LIST[socket.id] = socket; //lisätään arvottu id socket-listaan
	
	/* tätä funktiota kutsutaan, kun client lähettää viestin kirjautumisesta */
	/* VAROITUS: "CALLBACK HELL" ALLA, KULKU OMALLA VASTUULLA! */
	/* lisätietoja osoitteesta: http://callbackhell.com/ */
	socket.on('signIn',function(data){
		isValidPassword(data,function(res){ //viestissä tulee datana username ja password, tarkistetaan ovatko ne oikein
			if(res){
				Player.onConnect(socket); //kutsutaan Player-luokan funktiota (onConnect), joka luo uuden pelaajan
				socket.emit('signInResponse',{success:true}); //lähetetään viesti clientille onnistuneesta kirjautumisesta
			} else {
				socket.emit('signInResponse',{success:false});
			} 
		});
	});
	
	/* tätä funktiota kutsutaan, kun client lähettää viestin rekisteröitymisestä */
	/* VAROITUS: "CALLBACK HELL" ALLA, KULKU OMALLA VASTUULLA! */
	/* lisätietoja osoitteesta: http://callbackhell.com/ */
	socket.on('signUp',function(data){
		isUsernameTaken(data,function(res){ //viestissä tulee datana username ja password, tarkistetaan löytyykö käyttäjä jo
			if(res){
				socket.emit('signUpResponse',{success:false}); //käyttäjä löytyi jo -> epäonnistui
			} else {
				addUser(data, function(){ //käyttäjä vapaana -> lisätään
					socket.emit('signUpResponse',{success:true});
				});
			}
		});	
	});
	
	/* tätä funktiota kutsutaan, kun client katkaisee yhteyden */
	/* clientin ei tarvitse erikseen lähettää (emit) disconnect-viestiä, vaan se tehdään automaattisesti */
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id]; //poistetaan disconnectannut clientti listoilta
		Player.onDisconnect(socket);
	});
	
	/* tätä funktiota kutsutaan, kun client lähettää viestin chattiin */
	socket.on('sendMsgToServer',function(data){
		var playerName = ("" + socket.id).slice(2,7);
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',playerName + ': ' + data);
		}
	});
	
	/* tätä funktiota kutsutaan, kun client lähettää komennon (alkaa kauttamerkillä) */
	socket.on('evalServer',function(data){
		if(!DEBUG) //debug-mode pois päältä, ei tehdä mitään
			return;
		try {
			var res = eval(data);
		} catch (e) {
			res = e.message;
		}
		socket.emit('evalAnswer',res);
	});
	
});

/* loopataan läpi kaikki clientit (kutsutaan 60fps ~ 18ms välein) */
setInterval(function(){
	var pack = {
		player:Player.update(), //päivitetään kaikkien pelaajien sijainnit pakettiin
		bullet:Bullet.update(), //samoin bulletit
	}
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack); //lähetetään viestinä paketti kaikille clienteille uusista sijainneista
	}	
},1000/60);
/* Socket.io loppuu */