'use strict';
import splay = require('./splay');
import treevent = require('./treevent');

var x = {iKey: 1, aKey: ["aa", {b: 2}, false], oKey: {val: 1}};
x.aKey[1].b = 4;
treevent.Wrap(x);
x.aKey[1].b *= -1;
console.log(x);



/*
function logTree(x: splay.Tree) {
  console.log("Size: %d", x.length);
  console.log(x.keys());
  console.log(x.format());
}

var x = new splay.Tree();
logTree(x);

x.insertBefore(0, "a");
logTree(x);

x.insertBefore(1, "b");
logTree(x);

x.insertBefore(0, "c");
logTree(x);

x.insertBefore(3, "d");
logTree(x);

x.remove(2);
logTree(x);

x.remove(0);
logTree(x);

x.insertBefore(1, "n");
x.remove(x.length - 1);
logTree(x);
*/
