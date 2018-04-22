// This is a template for a Node.js scraper on morph.io (https://morph.io)

var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var url = require('url');
var async = require("async");
var assert = require('assert');

var numToursTotal = 0;
var numToursDone = 0;

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
    String.prototype.padStart = function padStart(targetLength,padString) {
        targetLength = targetLength>>0; //truncate if number or convert non-number to 0;
        padString = String((typeof padString !== 'undefined' ? padString : ' '));
        if (this.length > targetLength) {
            return String(this);
        }
        else {
            targetLength = targetLength-this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
            }
            return padString.slice(0,targetLength) + String(this);
        }
    };
}

function initDatabase(callback) {
	// Set up sqlite database.
	var db = new sqlite3.Database("data.sqlite");
	db.serialize(function() {
		db.run(`CREATE TABLE IF NOT EXISTS data (
			id INTEGER PRIMARY KEY,
			active INTEGER,
			lastSeen INTEGER, /* TODO text */
			date_from TEXT,
			date_to TEXT,
			duration INTEGER,
			status TEXT,
			type TEXT,
			level TEXT,
			grp TEXT,
			title TEXT,
			leiter TEXT,
			url TEXT,
			altitude TEXT,
			mtype TEXT,
			type_ext TEXT,
			level2 TEXT,
			arrival TEXT,
			text TEXT,
			equipment TEXT,
			subscription_period_start TEXT,
			subscription_period_end TEXT
		)`);

		db.run("UPDATE data SET active=0");

		callback(db);
	});
}

function updateRow(db, tour) {
	db.serialize(function() {
		// Insert some data.
		var statement = db.prepare(`INSERT OR REPLACE INTO data(
			id,
			active,
			lastSeen, /* TODO text */
			date_from,
			date_to,
			duration,
			status,
			type,
			level,
			grp,
			title,
			leiter,
			url,
			altitude,
			mtype,
			type_ext,
			level2,
			arrival,
			text,
			equipment,
			subscription_period_start,
			subscription_period_end
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
		statement.run(
			tour.id,
			tour.active,
			tour.lastSeen,
			tour.date_from,
			tour.date_to,
			tour.duration,
			tour.status,
			tour.type,
			tour.level,
			tour.group,
			tour.title,
			tour.leiter,
			tour.url,
			tour.altitude,
			tour.mtype,
			tour.type_ext,
			tour.level2,
			tour.arrival,
			tour.text,
			tour.equipment,
			tour.subscription_period_start,
			tour.subscription_period_end
		);
		statement.finalize();
	});
}

function readRows(db) {
	// Read some data.
	db.each("SELECT rowid AS id, name FROM data", function(err, row) {
		console.log(row.id + ": " + row.name);
	});
}

function fetchPage(url, callback) {
	// Use request to read in pages.
	request(url, function (error, response, body) {
		if (error) {
			console.log("Error requesting page " + url + ": " + error);
			return;
		}

		callback(body);
	});
}

// Mi 15. Aug. 2018 1 Tag
// Fr 30. Mär.  bis Mo 2. Apr. 2018
function parseDate2(str) {
	//console.log(":", str);
	assert.notEqual(str, '');

	const result = [];

	var block1 = str.replace(/[^\dA-Za-zöäü]+/g, ' ').trim().split(' ');

	var weekday = block1[0];
	var day = block1[1];
	var month = block1[2];
	var year = block1[3];
	var duration = block1[4];

	if (block1[3] == 'bis')
		return {
			from: parseDate2_int(block1[1], block1[2], block1[7]),
			to:   parseDate2_int(block1[5], block1[6], block1[7])
		};
	else
		return {
			from: parseDate2_int(block1[1], block1[2], block1[3]),
			to:   parseDate2_int(block1[1], block1[2], block1[3])
		};
}

function parseDate2_int(d, m, y) {
	var nMonth = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'].indexOf(m) + 1;
	assert(nMonth >= 1);
	assert(y >= 2000);
	assert(d >= 1);

	return y + '-' + nMonth.toString().padStart(2, '0') + '-' + d.toString().padStart(2, '0');
}

// von 1.12.2017 bis 1.4.2018
function parseDate3(str) {
	if (str === undefined) return {}
	var block1 = str.replace(/[^\dA-Za-zöäü]+/g, ' ').trim().split(' ');

	assert.equal('von', block1[0]);
	var day1 = block1[1];
	var month1 = block1[2];
	var year1 = block1[3];
	assert.equal('bis', block1[4]);
	var day2 = block1[5];
	var month2 = block1[6];
	var year2 = block1[7];
	assert.equal(8, block1.length);
	return {
		from: year1.toString().padStart(4, '0') + '-' + month1.toString().padStart(2, '0') + '-' + day1.toString().padStart(2, '0'),
		to: year2.toString().padStart(4, '0') + '-' + month2.toString().padStart(2, '0') + '-' + day2.toString().padStart(2, '0'),
	}
}

function run(db) {
	// Use request to read in pages.
	fetchPage("https://www.sac-uto.ch/de/touren-und-kurse/tourensuche.html?page=touren&year=&typ=&gruppe=&anlasstyp=&suchstring=", function (body) {
		console.log("Processing main list");

		// Use cheerio to find things in the page with css selectors.
		var $ = cheerio.load(body);

		var detailTasks = [];

		var elements = $("table.table tr").each(function () {
			var el = $(this).children().first()
			if (el.attr("colspan") > 1 || el.get(0).tagName != "td") return;
			var tour = {}
			tour.active = true
			tour.lastSeen = new Date().getTime();
			tour.rawDate = el.text().trim(); //day: Mo 31. Dez.

			if (el.hasClass("status_3"))
				tour.status = 'full';
			else if (el.hasClass("status_2"))
				tour.status = 'cancelled';
			else if (el.hasClass("without_register"))
				tour.status = 'ok';
			else if (el.hasClass("status_1"))
				tour.status = 'open';
			else if (el.hasClass("status_0"))
				tour.status = 'open';
			el = el.next()
			tour.type = el.text(); //type: Ss
			el = el.next()
			//console.log(el.text()); //icon
			el = el.next()
			tour.level = el.text(); //level: WT4
			el = el.next()
			tour.rawDuration = el.text(); //duration: 1 Tag
			el = el.next()
			tour.group = el.text(); //group: Senioren
			el = el.next()
			//console.log(el.text()); //?
			el = el.next()
			tour.title = el.text().trim(); //title: LVS Kurs f&uuml;r Seniorinnen und Senioren
			tour.url = el.find("a").attr("href"); // https://www.sac-uto.ch/de/touren-und-kurse/tourensuche.html?page=detail&amp;touren_nummer=5947
			tour.id = url.parse(tour.url, true).query.touren_nummer;
			el = el.next()
			tour.leiter = el.text(); //leiter: Alfred Lengacher
			//console.log("--", tour);

			numToursTotal++;
			detailTasks.push(function(callback){
				updateDetail(db, tour, callback);
			});
		});

		async.parallelLimit(detailTasks, 2, function(){
			// All tasks are done now
			//readRows(db);

			db.close();
		});
	});
}

function updateDetail(db, tour, callback) {
	fetchPage(tour.url, function (body) {
		// Use cheerio to find things in the page with css selectors.
		var $ = cheerio.load(body);
		numToursDone++;
		console.log("Processing details of tour " + tour.id + ', ' + numToursDone+' of '+numToursTotal);

		tour.title = $("h1").text().trim();

		var kv = {}

		$("table#droptours-detail tr").each(function () {
			var el = $(this).children().first()
			if (el.attr("colspan") > 1 || el.get(0).tagName != "td") return;
			var key = el.text().trim();
			el = el.next()
			var value = el.text().trim();
			kv[key] = value;
		});
		if (kv["Datum"] == undefined) {
			console.log("Page dump before error:", body);
		}
		var dd = parseDate2(kv["Datum"]); // Mi 15. Aug. 2018 1 Tag
		tour.date_from = dd.from;
		tour.date_to = dd.to;
		tour.group = kv["Gruppe"];	// Senioren
		tour.mtype = kv["Anlasstyp"];	// Tour
		//tour.leiter = kv["Leitung"];	// Dirk van't VeerWohnstadion Kirchenacker 58050 ZürichTelefon P 044 310 24 90Mobile 079 850 39 95E-Mail:
		tour.type_ext = kv["Typ/Zusatz:"];	// Aw (Alpinwandern (T4 - T6))
		tour.level2 = kv["Anforderungen"];	// Techn. T4
		tour.altitude = kv["Auf-, Abstieg/Marschzeit"];	// +900Hm,-900Hm/5h
		tour.arrival = kv["Reiseroute"];	// ÖV
		// kv["Karten"]);	// 1134
		tour.text = kv["Route / Details"];	// Mi: Ab Alp Selamatt (1390 m) über Hinterlucheren - Rügglizimmer - Rüggli zum Gipfel. Retour auf der gleichen Route. Telefonische Anmeldung auch am Vorabend von 18:00 bis 19:00 möglich.
		tour.equipment = kv["Ausrüstung"];	// Bergschuhen, ev. Stöcke, Regen- und Sonnenschutz. Verpflegung aus dem Rucksack
		dd = parseDate3(kv["Anmeldung"])	// von 23.7.2018 bis 13.8.2018
		tour.subscription_period_start = dd.from;
		tour.subscription_period_end = dd.to;

		//console.log(":", tour);
		updateRow(db, tour);
		callback();
	});
}

initDatabase(run);

/*
updateDetail(undefined, {url:"https://www.sac-uto.ch/de/touren-und-kurse/tourensuche.html?page=detail&touren_nummer=5898"}, undefined)
*/
