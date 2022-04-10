// simple api server, similar to what is described in https://morph.io/documentation/api
// not for a public server (missing security: no token check and no sql injection prevention!)

// GET https://api.morph.io/[scraper]/data.[format]?key=[api_key]&query=[sql]
// curl "https://api.morph.io/daald-docker/sac_uto_touren/data.json?key=7DuI8sU0F5twb0ptikCE&query=select%20*%20from%20%22data%22%20limit%2010"

const scraperName = 'daald-docker/sac_uto_touren'

const http = require('http'); // Loads the http module
const url = require('url');
const querystring = require('querystring');
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("data.sqlite");

function sendErr(response, err) {
	console.log('Sending error: ', err);
    response.writeHead(500);
    response.write(err);
    response.end();
}

http.createServer((request, response) => {

	var parsedUrl = url.parse(request.url)
	var parsedQuery = querystring.parse(parsedUrl.query)
	var dbquery = parsedQuery.query
	if (!dbquery.toLowerCase().startsWith('select ')) {
		sendErr(response, 'forbidden query');
		return;
	}
	console.log('Query:', dbquery)
	db.all(dbquery, function(err, rows) {
		if (err) {
			console.log(err);
			sendErr(response, err.message);
			return;
		}

	    // 1. Tell the browser everything is OK (Status code 200), and the data is in plain text
	    response.writeHead(200, {
	        'Content-Type': 'application/json'
	    });

	    // 2. Write the announced text to the body of the page
	    response.write(JSON.stringify(rows));

	    // 3. Tell the server that all of the response headers and body have been sent
	    response.end();
	});


}).listen(1337);

console.log('Morph light API ready')


/*

  {
    "id": 11074,
    "active": 0,
    "lastSeen": 1647769400168,
    "date_from": "2022-03-20",
    "date_to": "2022-03-22",
    "duration": null,
    "status": "ok",
    "type": "Sk",
    "level": "ZS",
    "grp": "Alpinist/innen",
    "title": "sUbiTO Wildstrubelgebiet",
    "leiter": "",
    "url": "https://www.sac-uto.ch/de/touren-und-kurse/touren/alpinist-innen?page=detail&offset=0&touren_nummer=11074",
    "altitude": "+1310Hm, -1650Hm / 7h",
    "mtype": "Tour",
    "type_ext": "Sk (Skitour)",
    "level2": "Techn. ZS",
    "arrival": "ÖV",
    "text": "So: Anfahrt zur Engstligenalp. Uebernachtung im Berghaus Bärtschi. Mo: Nach früher Tagwacht Aufstieg zum Grossstrubel 3243 m via Frühstücksplatz, mit einer kurzen Tragstrecke unter dem Frühstücksplatz (steil) und weiter zum Mittelgipfel  3242 m. Statt zum Grossstrubel eventuell direkt zum Mittelgipfel (WS+). Abfahrt zur Lämmerenhütte SAC 2507 m.\nDi: Aufstieg zum Roten Totz 2847 m. Anschliessend lange Abfahrt nach Kandersteg durch das Ueschinental (ganz am Schluss eventuell zu Fuss).",
    "equipment": "Skitourenausrüstung mit 3-Antennen-LVS-Gerät, Schaufel, Sonde, (Leicht-)Pickel, (Leicht-)Steigeisen, (Leicht-)Klettergurt mit zwei Reepschnüren, Bandschlinge sowie zwei Schraubkarabinern.",
    "subscription_period_start": "2022-03-16",
    "subscription_period_end": "2022-03-19"
  },
  {
    "id": 11075,
    "active": 0,
    "lastSeen": 1647885384945,
    "date_from": "2022-03-23",
    "date_to": "2022-03-23",
    "duration": null,
    "status": "open",
    "type": "Aw",
    "level": "T5",
    "grp": "Senior/innen",
    "title": "sUbiTO Stockflue 1137 m via Bützi",
    "leiter": "",
    "url": "https://www.sac-uto.ch/de/touren-und-kurse/touren/alpinist-innen?page=detail&offset=0&touren_nummer=11075",
    "altitude": "+800Hm, -100Hm / 3h",
    "mtype": "Tour",
    "type_ext": "Aw (Alpinwandern (T4 - T6))",
    "level2": "Techn. T5",
    "arrival": "ÖV: Zürich HB - Zug - Brunnen - Seilbahn Urmiberg Talstation",
    "text": "Mi: Von der Talstation der Seilbahn Urmiberg 436 m Aufstieg nach Krähen 576 m und durch den Wald mit ein paar einfachen Kraxeleien hoch zum Bützi 916 m (T4). Sehr steiler Abstieg vom Bützi (T5). Zur Sicherung dient ein durchgehendes Stahlseil. Weiterer Aufstieg zur Stockflue (1137 m), im Volksmund Dume genannt. Einfacher Weiterweg zum Rest. Urmiberg 1129 m.",
    "equipment": "Gute Bergschuhe, Mobiltelefon, ev. Handschuhe für das Drahtseil beim Abstieg vom Bützi, SAC Ausweis mit Notfallkontakt, Bargeld für das Mittagessen.",
    "subscription_period_start": "2022-03-18",
    "subscription_period_end": "2022-03-21"
  },
  {
    "id": 11082,
    "active": 1,
    "lastSeen": 1648771979513,
    "date_from": "2022-04-03",
    "date_to": "2022-04-03",
    "duration": null,
    "status": "ok",
    "type": "Sp",
    "level": "5a",
    "grp": "Jugend",
    "title": "",
    "leiter": "",
    "url": "https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/?page=detail&offset=0&touren_nummer=11082",
    "altitude": "Ein paar Minuten zu Fuss.",
    "mtype": "Tour",
    "type_ext": "Sp (Sport- / Plaisirklettern)",
    "level2": "Techn. 5a",
    "arrival": null,
    "text": "Diese Tour richtet sich in erster Linie an die Teilnehmer*innen des regelmässigen JO Klettertreffs.",
    "equipment": "Klettergurt, Kletterfinken, Sicherungsgerät, Karabiner, (Selbstsicherungs-) Schlinge, Helm, Rucksack mit Lunch.",
    "subscription_period_start": "2022-03-26",
    "subscription_period_end": "2022-03-31"
  }
]


*/
