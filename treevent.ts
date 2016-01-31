import splay = require('./splay');

/*
Remaining:
2) Array parent-child
 a) Tree structure
 b) Message passing
 c) Detachment
3) Listeners
4) Better array events
 a) Replace push/slice/...
*/

export var _sym = Symbol('treevent');

interface TreeventMeta {
  attachToParent(parent: any, key: string);
  directChange(path: string, oldValue: any, newValue: any);
  pathChange(path: Array<any>, oldValue: any, newValue: any);
  keyToPath(key: string): any;
}

export function meta(target: any): TreeventMeta {
  return canTrack(target) ? (<TreeventMeta>target[_sym]) : null;
}

function reparent(target: any, parent: any, parentKey: string) {
  var childMeta = meta(target);
  if (childMeta !== null) {
    childMeta.attachToParent(parent, parentKey);
  }
}

function genID(): string {
  var d = new Date().getTime();
  return 'xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16;
      d = Math.floor(d/16);
      return r.toString();
  });
}

const symbolTest = Symbol('test');
function canTrack(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  value[symbolTest] = true;
  return value[symbolTest] === true;
}


function WrapArray(array: Array<any>) {
  console.log("Wrapping array...");
  array[_sym] = new ArrayMeta(array);
  array.forEach(v => Wrap(v));
  // EW :(
  (<any>Object).observe(array, ArrayListener(array));
}

function WrapObject(obj: Object) {
  console.log("Wrapping object...");
  obj[_sym] = new ObjectMeta(obj);
  for (var key in obj) {
    Wrap(obj[key]);
    reparent(obj[key], obj, key);
  }
  // EW :(
  (<any>Object).observe(obj, ObjectListener(obj));
}

export function Wrap(value: any): void {
  if (value === null || value === undefined) {
    // Ignore
  } else if (value[_sym] !== undefined) {
    // No-op, already wrapped!
  } else if (Array.isArray(value)) {
    WrapArray(value);
  } else if (canTrack(value)) {
    WrapObject(value);
  } else {
    // No-op, primitive!
  }
}

function Unwrap(value: any): void {
  // TODO?
}

function ObjectListener(target: Object): Function {
  return (changes => changes.forEach(handleObjectChange));
}

function handleObjectChange(change: any) {
  var {name, object: target, oldValue, type} = change;
  var newValue = target[name];
  var meta: ObjectMeta = target[_sym];
  meta.directChange(name, oldValue, newValue);
}

function ArrayListener(target: Object): Function {
  return (changes => { 
    if (changes.length == 1) handleArrayChange(changes[0]);
  });
}

function handleArrayChange(change: any) {
  console.log(change);
  var {name, object: target, oldValue, type} = change;
  var newValue = target[name];
  var meta: ArrayMeta = target[_sym];
  meta.directChange(name, oldValue, newValue);
}

class ArrayMeta implements TreeventMeta {
  target: Array<any>;
  parent: any;
  parentKey: string;

  constructor(target: Array<any>) {
    this.target = target;
  }

  attachToParent(parent: any, key: string) {
    this.parent = parent;
    this.parentKey = key;
  }

  directChange(path: string, oldValue: any, newValue: any) {
    Unwrap(oldValue);
    Wrap(newValue);

    // TODO - use tree.
    // var index = +path;
    // var indexKey = nthNode(index);

    this.pathChange([path], oldValue, newValue);
  }

  pathChange(path: Array<any>, oldValue: any, newValue: any) {
    console.log("%s changes, %s -> %s", JSON.stringify(path), oldValue, newValue);
  }

  keyToPath(key: string): string {
    throw "TODO";
  }
}

class ObjectMeta implements TreeventMeta {
  target: Object;
  parent: any;
  parentKey: string;

  constructor(target: Object) {
    this.target = target;
  }

  attachToParent(parent: any, key: string) {
    this.parent = parent;
    this.parentKey = key;
  }

  directChange(path: string, oldValue: any, newValue: any) {
    Unwrap(oldValue);
    Wrap(newValue);
    reparent(newValue, this.target, path);
    this.pathChange([path], oldValue, newValue);
  }

  pathChange(path: Array<any>, oldValue: any, newValue: any) {
    console.log("%s changes, %s -> %s", JSON.stringify(path), oldValue, newValue);
    var parentMeta = meta(this.parent);

    if (parentMeta !== null) {
      // NOTE: reverse path instead? Have immutable version?
      path.unshift(parentMeta.keyToPath(this.parentKey)); 
      parentMeta.pathChange(path, oldValue, newValue);
    }
  }

  keyToPath(key: string): string {
    return key;
  }
}
