/*
 "beaners": 1,
  "beaner": 1,
  "bimbo": 1,
  "coon": 1,
  "coons": 1,
  "cunt": 1,
  "cunts": 1,
  "darkie": 1,
  "darkies": 1,
  "fag": 1,
  "fags": 1,
  "faggot": 1,
  "faggots": 1,
  "hooker": 1,
  "kike": 1,
  "kikes": 1,
  "nazi": 1,
  "nazis": 1,
  "neonazi": 1,
  "neonazis": 1,
  "negro": 1,
  "negros": 1,
  "nigga": 1,
  "niggas": 1,
  "nigger": 1,
  "niggers": 1,
  "paki": 1,
  "pakis": 1,
  "raghead": 1,
  "ragheads": 1,
  "shemale": 1,
  "shemales": 1,
  "slut": 1,
  "sluts": 1,
  "spic": 1,
  "spics": 1,
  "swastika": 1,
  "towelhead": 1,
  "towelheads": 1,
  "tranny": 1,
  "trannys": 1,
  "trannies": 1,
  "twink": 1,
  "twinks": 1,
  "wetback": 1,
  "wetbacks": 1
*/

const censorRegex = /\b(beaners|beaner|coon|coons|darkie|darkies|fag|faggot|fags|faggots|faggy|kike|kikes|pedo|pedo|pedophile|paedophile|nigga|niggas|negro|negros|nigger|niggers|paki|pakis|raghead|ragheads|rape|rapes|rapey|rapist|rapists|raping|wetback|wetbacks)\b/gi


function censor(text, replace="#####") {
  return text.replaceAll(censorRegex, replace);
}

module.exports = { censor };