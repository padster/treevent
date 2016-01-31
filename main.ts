'use strict';
import splay = require('./splay');
import treevent = require('./treevent');

/*
var x = {iKey: 1, aKey: ["aa", {b: 2}, false], oKey: {val: 1}};
treevent.Wrap(x);
console.log(x);
console.log(Object.getOwnPropertySymbols(x));
*/

var x = new splay.Tree();
console.log(x.keys());
