var assert = require('assert');

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
			from: parseDate2_int(block1[1], block1[2], block1[7], str),
			to:   parseDate2_int(block1[5], block1[6], block1[7], str)
		};
	else
		return {
			from: parseDate2_int(block1[1], block1[2], block1[3], str),
			to:   parseDate2_int(block1[1], block1[2], block1[3], str)
		};
}

const monthNames = [undefined, 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
function parseMonth(str) {
	var nMonth;
	if (!isNaN(+str))
		nMonth = +str;
	else if (str == "MÃ¤rz") // charset error in page around dec 2024
		nMonth = 3;
	else
		nMonth = monthNames.indexOf(str.substr(0,3));
	assert(nMonth >= 1 && nMonth <= 12);
	return nMonth;
}

function parseDate2_int(d, m, y, str) {
	var nMonth = parseMonth(m);
	assert(nMonth >= 1);
	assert(y >= 2000, "Could not parse date in "+str + " ("+d+","+m+","+y+")");
	assert(d >= 1, "Could not parse date in "+str + " ("+d+","+m+","+y+")");

	return y + '-' + nMonth.toString().padStart(2, '0') + '-' + d.toString().padStart(2, '0');
}


function parseDate3_datestr(str, token) {
	var block1 = str.replace(/[,.  ]+/g, ' ').trim().split(' ');
	assert.equal(token, block1[0], "no '" + token + "' in date '" + str + "'");
	assert.equal(5, block1.length, "bogus number of elements in date '" + str + "'");
	var weekday1 = block1[1];
	var day1 = block1[2];
	var month1 = parseMonth(block1[3]);
	var year1 = block1[4];
	return year1.toString().padStart(4, '0') + '-' + month1.toString().padStart(2, '0') + '-' + day1.toString().padStart(2, '0')
}

/* formats:
 * "Schriftlich, Internet von Mi 22. Mai 2019 bis Sa 25. Mai 2019, Max. TN 15"
 * "Internet von Mi 22. Mai 2019 bis Sa 25. Mai 2019"
 * "von Mi 1. Jan. 2025 bis So 2. März 2025"
 * "Internet von Do 1. Nov. 2018, Max. TN 4"
 * "von So 2. Jun. 2019 bis Fr 28. Jun. 2019, Max. TN 6"
 * bis Fr 16. Sept. 2022, Max. TN 8
 */
function parseDate3(str) {
	if (str === undefined) return {}

	// working from last to first token
	var res = {}

	i = str.indexOf(', Max. TN ')
	if (i > 0) str = str.substr(0, i)

	var i = str.indexOf('bis ')
	if (i >= 0) {
		res.to = parseDate3_datestr(str.substr(i), 'bis')
		str = str.substr(0, i)
	}

	var i = str.indexOf('von ')
	if (i >= 0) {
		res.from = parseDate3_datestr(str.substr(i), 'von')
		str = str.substr(0, i)
	}

	return res
}


exports.parseDate2 = parseDate2;
exports.parseDate3 = parseDate3;
