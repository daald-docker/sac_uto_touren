// This is a template for a Node.js scraper on morph.io (https://morph.io)

var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var url = require('url');
var async = require("async");
var assert = require('assert');
var sacdateparser = require('./sacdateparser');

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
		//db.run("ALTER TABLE data DROP COLUMN duration"); // not supported yet
		db.run("ALTER TABLE data ADD COLUMN extra_info TEXT", function(error){});

		db.run("BEGIN TRANSACTION");
		db.run("UPDATE data SET active=0");

		callback(db);
	});
}

function updateRow(db, tour) {
	if (db == undefined) {
		console.log("REC: ", tour);
		return;
	}
//console.log("REC: ", tour);
	db.serialize(function() {
		// Insert some data.
		var statement = db.prepare(`INSERT OR REPLACE INTO data (
			id,
			active,
			lastSeen, /* TODO text */
			date_from,
			date_to,
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
			extra_info,
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
			tour.extra_info,
			tour.equipment,
			tour.subscription_period_start,
			tour.subscription_period_end
		);
		statement.finalize();
	});
}

function fetchPage(url, callback) {
	// Use request to read in pages.
	var reqObj = {
		url: url,
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.183 Safari/537.36 Vivaldi/1.96.1147.36'
		}
	}
	request(reqObj, function (error, response, body) {
		if (error) {
			console.log("Error requesting page " + url + ": " + error);
			return;
		}

		callback(body);
	});
}

function run(db, offset=0) {
	// Use request to read in pages.
	fetchPage("https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/?page=touren&year=&typ=&gruppe=&anlasstyp=&suchstring=&offset="+offset, function (body) {
		console.log("Processing main list");

		// Use cheerio to find things in the page with css selectors.
		var $ = cheerio.load(body);

		var detailTasks = [];

		var elements = $("table.table tr")

		if (offset == 0 && elements.length == 0) {
			console.log("No data found in index (search) page");
			process.exit(1);
		}

		elements.each(function () {
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
			tour.url = el.find("a").attr("href"); // https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/.html?page=detail&amp;touren_nummer=5947
			tour.id = url.parse(tour.url, true).query.touren_nummer;
			el = el.next()
			tour.leiter = el.text(); //leiter: Alfred Lengacher
			//console.log("--", tour);

			numToursTotal++;
			detailTasks.push(function(callback){
				updateDetail(db, tour, callback);
			});
		});

		//detailTasks = detailTasks.slice(0, 5)  // reduce number of pages for testing

		async.parallelLimit(detailTasks, 2, function(){
			// All tasks are done now
			if (detailTasks.length > 100) {
				run(db, offset + 200);
			} else {
				//readRows(db);
				db.serialize(function() {
					console.log("Committing and closing");
					db.run("COMMIT");

					db.close();
				});
			}
		});
	});
}

function updateDetail(db, tour, callback, retry=1) {
	fetchPage(tour.url, function (body) {
		// Use cheerio to find things in the page with css selectors.
		var $ = cheerio.load(body);
		var title = $("head title").text().trim();
		var loaderror = false;
		if (title == 'Oops, an error occurred!') {
			console.log("There was an error with tour "+tour.id+": <"+title+"> <"+$(".callout-body").text().trim()+">");
			loaderror = true;
		}
		if (title == '500 Internal Server Error' || title == '502 Bad Gateway' || title == '504 Gateway Time-out') {
			console.log("There was an error with tour "+tour.id+": <"+title+"> <"+$("body").text().trim()+">");
			loaderror = true;
		}
		if (loaderror) {
			if (retry>0) {
				console.log("retry");
				updateDetail(db, tour, callback, retry-1)
			} else {
				console.log("abort");
				process.exit(1);
			}
			return;
		}
		numToursDone++;
		console.log("Processing details of tour " + tour.id + ', ' + numToursDone+' of '+numToursTotal + "\t\t" + tour.url);

		tour.title = $("h2").text().trim();
		tour.leiter = $(".droptours-address-name").text().trim();

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
		var dd = sacdateparser.parseDate2(kv["Datum"]); // Mi 15. Aug. 2018 1 Tag
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
		tour.extra_info = kv["Zusatzinfo"];
		tour.equipment = kv["Ausrüstung"];	// Bergschuhen, ev. Stöcke, Regen- und Sonnenschutz. Verpflegung aus dem Rucksack
		dd = sacdateparser.parseDate3(kv["Anmeldung"])	// von 23.7.2018 bis 13.8.2018 [oder ohne bis]
		tour.subscription_period_start = dd.from;
		tour.subscription_period_end = dd.to;

		//console.log(":", tour);
		updateRow(db, tour);
		callback();
	});
}

var args = process.argv.slice(2);

if (args.length > 0) {
	updateDetail(undefined, {url:args[0]}, function(){})
	return
}

initDatabase(run);

/*
updateDetail(undefined, {url:"https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/.html?page=detail&touren_nummer=5898"}, undefined)
*/
