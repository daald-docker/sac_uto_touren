const sacdateparser = require('./sacdateparser')
 
test('parseDate3 complete', () => {
  expect(sacdateparser.parseDate3('Schriftlich, Internet von Mi 22. Mai 2019 bis Sa 25. Mai 2019, Max. TN 15')).toStrictEqual({
    "from": "2019-05-22",
    "to": "2019-05-25",
  });
});
 
test('parseDate3 mixed', () => {
  expect(sacdateparser.parseDate3('Internet von Mi 22. Mai 2019 bis Sa 25. Mai 2019')).toStrictEqual({
    "from": "2019-05-22",
    "to": "2019-05-25",
  });
});
 
test('parseDate3 from only', () => {
  expect(sacdateparser.parseDate3('Internet von Do 1. Nov. 2018, Max. TN 4')).toStrictEqual({
    "from": "2018-11-01",
  });
});
 
test('parseDate3 full', () => {
  expect(sacdateparser.parseDate3('von So 2. Jun. 2019 bis Fr 28. Jun. 2019, Max. TN 6')).toStrictEqual({
    "from": "2019-06-02",
    "to": "2019-06-28",
  });
});
 
test('parseDate3 to only', () => {
  expect(sacdateparser.parseDate3('bis Fr 16. Sept. 2022, Max. TN 8')).toStrictEqual({
    "to": "2022-09-16",
  });
});

