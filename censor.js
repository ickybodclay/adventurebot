const censorRegex = /\b(fag|faggot|fags|faggots|nigga|niggas|nigger|niggers|rape|rapes|rapist|rapists|raping)\b/gi


function censor(text, replace="*") {
  return text.replaceAll(censorRegex, replace);
}

module.exports = { censor };