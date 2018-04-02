// This is a template for a Node.js scraper on morph.io (https://morph.io)

var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var url = require('url');
var async = require("async");
var assert = require('assert');

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
			subscription_period TEXT
		)`);
		callback(db);
	});
}

function updateRow(db, tour) {
	// Insert some data.
	var statement = db.prepare(`INSERT INTO data(
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
			subscription_period
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
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
			tour.subscription_period
	);
	statement.finalize();
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

function parseDate1(str, monthLine) {
	assert.notEqual(monthLine, '');

	// str format:       'Sa 31. Apr. '
	// monthLine format: 'April 2016'

	var block1 = str.replace(/[^\dA-Za-zöäü]+/g, ' ').trim().split(' ');
	var block2 = monthLine.replace(/[^\d.A-Za-zöäü]+/g, ' ').trim().split(' ');

	var weekday = block1[0];
	var day = block1[1];
	var month1 = block1[2];
	var month2 = block2[0];
	var year = block2[1];

	assert.equal(month1, month2.substr(0, month1.length)); // Make sure Apr == April

	var nMonth = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'].indexOf(month1) + 1;
	assert(nMonth >= 1);
	assert(year >= 2000);
	assert(day >= 1);

	return year + '-' + ('0'+nMonth).slice(-2) + '-' + ('0'+day).slice(-2);
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

	return y + '-' + ('0'+nMonth).slice(-2) + '-' + ('0'+d).slice(-2);
}

function run(db) {
	// Use request to read in pages.
	fetchPage("https://www.sac-uto.ch/de/touren-und-kurse/tourensuche.html?page=touren&year=&typ=&gruppe=&anlasstyp=&suchstring=", function (body) {
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
			console.log("--", tour);

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
		console.log("round2");

		tour.title2 = $("h1").text().trim();

		var kv = {}

		$("table#droptours-detail tr").each(function () {
			var el = $(this).children().first()
			if (el.attr("colspan") > 1 || el.get(0).tagName != "td") return;
			var key = el.text().trim();
			el = el.next()
			var value = el.text().trim();
			kv[key] = value;
		});
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
		tour.subscription_period = kv["Anmeldung"];	// von 23.7.2018 bis 13.8.2018

		//console.log(":", tour);
		updateRow(db, tour);
		callback();
	});
}

initDatabase(run);

/*
updateDetail(undefined, {url:"https://www.sac-uto.ch/de/touren-und-kurse/tourensuche.html?page=detail&touren_nummer=5898"}, undefined)
*/
