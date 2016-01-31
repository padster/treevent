import splay = require('./splay');

/*
Remaining:
1) Array index mutation methods
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#Methods_2
2) Listeners
3) Better tests / documentation etc...
*/

export let _sym = Symbol('treevent');

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
  let childMeta = meta(target);
  if (childMeta !== null) {
    childMeta.attachToParent(parent, parentKey);
  }
}

function genID(): string {
  let d = new Date().getTime();
  // HACK - improve. Small only for testing.
  return 'xxxxx'.replace(/x/g, function(c) {
    let r = ((d + Math.random()*16)%16) | 0;
    d = Math.floor(d/16);
    return "0123456789ABCDEF".charAt(r);
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
  let meta = new ArrayMeta(array);
  array[_sym] = meta;
  array.forEach(v => {
    Wrap(v);
    reparent(v, array, meta.pushID());
  });
  // EW :(
  (<any>Object).observe(array, ArrayListener(array));
}

function WrapObject(obj: Object) {
  obj[_sym] = new ObjectMeta(obj);
  for (let key in obj) {
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
  let {name, object: target, oldValue, type} = change;
  let newValue = target[name];
  let meta: ObjectMeta = target[_sym];
  meta.directChange(name, oldValue, newValue);
}

function ArrayListener(target: Object): Function {
  return (changes => { 
    if (changes.length == 1) handleArrayChange(changes[0]);
  });
}

function handleArrayChange(change: any) {
  // console.log(change);
  let {name, object: target, oldValue, type} = change;
  let newValue = target[name];
  let meta: ArrayMeta = target[_sym];
  meta.directChange(name, oldValue, newValue);
}

class ArrayMeta implements TreeventMeta {
  target: Array<any>;
  parent: any;
  parentKey: string;
  tree: splay.Tree;

  constructor(target: Array<any>) {
    this.target = target;
    this.tree = new splay.Tree();
  }

  attachToParent(parent: any, key: string) {
    this.parent = parent;
    this.parentKey = key;
  }

  directChange(path: string, oldValue: any, newValue: any) {
    Unwrap(oldValue);
    Wrap(newValue);

    // TODO - use tree.
    let index = +path;
    let key = this.tree.keyForIndex(index);
    reparent(newValue, this.target, key);

    this.pathChange([path], oldValue, newValue);
  }

  pathChange(path: Array<any>, oldValue: any, newValue: any) {
    console.log("%s changes, %s -> %s", JSON.stringify(path), oldValue, newValue);
    let parentMeta = meta(this.parent);

    if (parentMeta !== null) {
      // NOTE: reverse path instead? Have immutable version?
      path.unshift(parentMeta.keyToPath(this.parentKey)); 
      parentMeta.pathChange(path, oldValue, newValue);
    }
  }

  keyToPath(key: string): string {
    // PICK - change return type to number?
    return "" + this.tree.indexForKey(key);
  }
  
  pushID(): string {
    let newId = genID();
    this.tree.push(newId);
    return newId;
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
    let parentMeta = meta(this.parent);

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
