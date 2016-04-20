/* MongoJS alustus */
var mongojs = require("mongojs");
var db = mongojs('heroku_jftr8gc7:koodari13@ds013951.mlab.com:13951/heroku_jftr8gc7', ['account']) //MongoLab
//var db = mongojs('localhost:27017/tietokanta', ['account']); //localhost

/* ExpressJS alkaa */
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
/* ExpressJS loppuu */

/* vakiot */
var CANVAS_HEIGHT = 500;
var CANVAS_WIDTH = 500;
var PLAYER_WIDTH = 20;
var PLAYER_HEIGHT = 20;

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
var Player = function(id, username, score){
	var self = Entity(); //luokka peritään Entitystä
	/* lisätään Entityn attribuuttien lisäksi pelaajalle omia attribuutteja */
	self.id = id;
	self.username = username;
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;
	self.hp = 400;
	self.isDead = false;
	self.score = score;
	
	var super_update = self.update; //otetaan alkuperäinen Entityn update-funktio talteen muuttujaan (super_update)
	self.update = function(){ //ylikirjoitetaan update-funktio
		if(!self.isDead){
			self.updateSpd(); //päivitetään pelaajan nopeus
			super_update(); //kutsutaan alkuperäistä Entityn update-funktiota, joka päivittää sijainnin nopeuden perusteella
			
			/* estetään pelaajan liikkuminen reunojen ulkopuolelle */
			if(self.x < PLAYER_WIDTH/2)
				self.x = PLAYER_WIDTH/2;
			if(self.x > CANVAS_WIDTH-PLAYER_WIDTH/2)
				self.x = CANVAS_WIDTH-PLAYER_WIDTH/2;
			if(self.y < PLAYER_HEIGHT/2)
				self.y = PLAYER_HEIGHT/2;
			if(self.y > CANVAS_HEIGHT-PLAYER_HEIGHT/2)
				self.y = CANVAS_HEIGHT-PLAYER_HEIGHT/2;
			
			/* ammutaan bulletteja, kun hiiren painike on alaalla */
			if(self.pressingAttack){
				self.shootBullet(self.mouseAngle);
			}
			self.shootBullet = function(angle){
				var b = Bullet(self.id,angle);
				b.x = self.x; //bullet luodaan pelaajan sijaintiin
				b.y = self.y;
			}
			
			/* kuolema */
			if(self.hp <= 0){
				self.isDead = true;
				self.x = 6666;
				self.y = 6666;
				setTimeout(function(){
					self.respawn(); //pelaaja respawnaa 5 sekuntia kuoleman jälkeen
				},5000);
			}
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
	
	/* respawnataan pelaaja random sijaintiin */
	self.respawn = function(){
		self.x = Math.floor(Math.random() * (CANVAS_WIDTH-PLAYER_WIDTH/2)) + PLAYER_WIDTH/2;
		self.y = Math.floor(Math.random() * (CANVAS_HEIGHT-PLAYER_HEIGHT/2)) + PLAYER_HEIGHT/2;
		self.hp = 400;
		self.isDead = false;
	}
	
	/* lisätään scorea tapoista */
	self.upScore = function(){
		self.score = self.score + 100;
	}
	
	Player.list[id] = self; //lisätään pelaaja listaan luonnin yhteydessä
	return self;
}

/* lista kaikista pelaajista, HUOM! STAATTINEN (vain yksi lista pelaajista on olemassa, yhteinen kaikille Pelaaja-luokan olioille) */
Player.list = {};

/* kaikki loput funktiot ovat staattisia Pelaaja-luokan funktioita (= yhteisiä kaikille Pelaaja-luokan olioille) */

/* tätä funktiota kutsutaan, kun uusi client ottaa yhteyden serveriin */
Player.onConnect = function(socket, username){
	getScore(username,function(res){ //haetaan tietokannasta käyttäjän score 
		var player = Player(socket.id, username, res); //luodaan uusi pelaaja kannasta haetulla entisellä scorella
		
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
	});
}

/* tätä funktiota kutsutaan, kun client katkaisee yhteyden */
Player.onDisconnect = function(socket){
	var player = Player.list[socket.id]; //haetaan pelaaja listalta
	if(player != null){
		updateScore(player.username,player.score,function(res){ //päivitetään score tietokantaan
			delete Player.list[socket.id]; //poistetaan pelaaja listalta
		});
	}
}

/* update funktio, joka päivittää kaikki pelaajat */
Player.update = function(){
	var pack = []; //paketti, joka pitää sisällään tiedot kaikista pelaajista
	for(var i in Player.list){
		var player = Player.list[i];
		player.update(); //päivitetään pelaajan sijainti + muut
		pack.push({ //lisätään sijainti + muut pakettiin
			x:player.x,
			y:player.y,
			username:player.username,
			isdead:player.isDead,
			score:player.score
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
			self.toRemove = true; //poistetaan bulletti tietyn ajan kuluttua (tai sen osuessa)
		super_update();

		/* loopataan läpi kaikki pelaajat ja tarkistetaan, onko etäisyys alle 32 & ettei kyseinen pelaaja omista bullettia */
		/* jos nämä ehdot toteutuvat -> törmäys */
		for (var i in Player.list){
			var p = Player.list[i];
			if(self.getDistance(p) < 32 && self.parent !== p.id){ 
				p.hp = p.hp - 50; //vähennetään pelaajalta hp:ta
					if(p.hp == 0){ //tappava osuma, annetaan ampujalle pisteitä
						for (var j in Player.list){ //etsitään listasta bulletin omistaja (=ampuja) ja lisätään tälle scorea
							var b = Player.list[j];
							if(self.parent === b.id)
								b.upScore();
						}
					}
				self.toRemove = true;
			}
		}
	}
	Bullet.list[self.id] = self; //lisätään bulletti listaan luonnin yhteydessä
	return self;
}

/* lista kaikista bulleteista, HUOM! STAATTINEN (vain yksi lista bulleteista on olemassa, yhteinen kaikille Bullet-luokan olioille) */
Bullet.list = {};

/* staattinen update funktio, joka päivittää kaikki bulletit (samanlainen kuin Pelaaja-luokalla) */
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


/* Socket.IO alkaa */
/* alustetaan Socket.IO */
var io = require('socket.io')(serv,{});

/* lista kaikista socketeista */
var SOCKET_LIST = {};

/* debug-mode, sallii komentojen lähettämisen */
var DEBUG = true; //vaihdetaan falseksi release-versiossa!

/* tietokanta queryt alkaa */
/* tietokannassa viivettä -> täytyy käyttää callbackejä */
var isValidPassword = function(data,cb){
	//syntaksi: db.<COLLECTION>.find(<MUST MATCH>);
	db.account.find({username:data.username,password:data.password},function(err,res){
		if(res.length > 0) //match löytyi kannasta (responsen pituus > 0)
			cb(true);
		else
			cb(false);
	});
}
var isUsernameTaken = function(data,cb){
	//syntaksi: db.<COLLECTION>.find(<MUST MATCH>);
	db.account.find({username:data.username},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});
}
var addUser = function(data,cb){
	db.account.insert({username:data.username,password:data.password,score:0},function(err){ //insertille ei ole responsea
		cb();
	});
}
var getScore = function(username,cb){
	//syntaksi: db.<COLLECTION>.find(<MUST MATCH>,<TO RETRIEVE>);
	db.account.find({username:username},{score:1},function(err,res){
		cb(res[0].score); //parsitaan responsesta score
	});
}
var updateScore = function(username,score,cb){
	//syntaksi: db.<COLLECTION>.update(<MUST MATCH>,{$set:<NEW VALUES>});
	db.account.update({username:username},{$set:{score:score}},function(err){
		cb();
	});
}
var getHighscores = function(cb){
	//sorttaa scoret suurimmasta pienimpään (-1, ascending olisi 1) ja ottaa top 5, palauttaa käyttäjän + scoren
	db.account.find({},{username:1,score:1}).sort({score:-1}).limit(5,function(err,res){
		cb(res);
	});
}
/* tietokanta queryt loppuu */


/* tätä funktiota kutsutaan, kun uusi client ottaa yhteyden serveriin */
io.sockets.on('connection', function(socket){
	console.log('Client yhdisti.'); 
	socket.id = Math.random(); //arvotaan clientille random id
	SOCKET_LIST[socket.id] = socket; //lisätään arvottu id socket-listaan
	
	/* tätä funktiota kutsutaan, kun client lähettää viestin kirjautumisesta */
	socket.on('signIn',function(data){
		isValidPassword(data,function(res){ //viestissä tulee datana username ja password, tarkistetaan ovatko ne oikein
			if(res){
				Player.onConnect(socket, data.username); //kutsutaan Player-luokan funktiota (onConnect), joka luo uuden pelaajan
				socket.emit('signInResponse',{success:true}); //lähetetään viesti clientille onnistuneesta kirjautumisesta
			} else {
				socket.emit('signInResponse',{success:false});
			} 
		});
	});
	
	/* tätä funktiota kutsutaan, kun client lähettää viestin rekisteröitymisestä */
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
		Player.onDisconnect(socket); //ja päivitetään score tietokantaan
	});
	
	/* tätä funktiota kutsutaan, kun client lähettää viestin chattiin */
	socket.on('sendMsgToServer',function(data){
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',data.playername + ': ' + data.message);
		}
	});
	
	/* tätä funktiota kutsutaan, kun client lähettää komennon (alkaa kauttamerkillä) */
	socket.on('evalServer',function(data){
		if(!DEBUG) //debug-mode pois päältä, ei tehdä mitään
			return;
		try {
			var res = eval(data); //debugataan
		} catch (e) {
			res = e.message;
		}
		socket.emit('evalAnswer',res);
	});
	
	/* tätä funktiota kutsutaan, kun client lähettää pyynnön highscoreista */
	socket.on('highscore',function(){
		getHighscores(function(res){ //haetaan highscoret kannasta
			socket.emit('highscoreResponse',res); //lähetetään clientille viestinä taulukko, jossa top 5 pelaajien nimet + scoret
		});
	});
	
});

/* loopataan läpi kaikki clientit (30fps) */
setInterval(function(){
	var pack = {
		player:Player.update(), //päivitetään kaikkien pelaajien sijainnit pakettiin
		bullet:Bullet.update(), //samoin bulletit
	}
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack); //lähetetään viestinä paketti kaikille clienteille uusista sijainneista
	}	
},1000/30);
/* Socket.IO loppuu */