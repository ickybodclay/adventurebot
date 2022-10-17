const censorRegex = /\b(beaners|beaner|coon|coons|darkie|darkies|fag|faggot|fags|faggots|faggy|kike|kikes|pedo|pedo|pedophile|paedophile|nigga|niggas|negro|negros|nigger|niggers|paki|pakis|raghead|ragheads|rape|rapes|rapey|rapist|rapists|raping|towelhead|towelheads|wetback|wetbacks)\b/ig;


function censor(message, replace="#####") {
  return message.replaceAll(censorRegex, replace);
}

module.exports = { censor };