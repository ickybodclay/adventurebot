function escapeJsonValue(unsafe) {
  return unsafe.replace(/'"]/g, function (c) {
    switch (c) {
      case "'":
        return "\\'";
      case '"':
        return '\\"';
    }
  });
}

module.exports = { escapeJsonValue };
