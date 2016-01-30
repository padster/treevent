'use strict';
import treevent = require('./treevent');

var x = {iKey: 1, aKey: ["aa", {b: 2}, false]};
treevent.Wrap(x);
console.log(x);
console.log(Object.getOwnPropertySymbols(x));