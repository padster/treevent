import splay = require('./splay');

/*
Remaining:
2) Better tests / documentation etc...
*/

export let _sym = Symbol('treevent');

function cast<T>(instance, ctor: { new(...args: any[]): T }): T {
    if (instance instanceof ctor) return instance;
    throw new Error('type cast exception');
}

interface TreeventMeta {
  attachToParent(parent: any, key: string);
  pathChange({path: Array, type: string, index: number, oldValue, newValue});
  keyToPath(key: string): number|string;
  listen(path: string, listener: Listener) : ()=>void;
}

type Listener = (path: Array<string>, params: any, type: string, index: number, oldValue: any, newValue: any) => any

export function Meta(target: any): TreeventMeta {
  return canTrack(target) ? (<TreeventMeta>target[_sym]) : null;
}

function reparent(target: any, parent: any, parentKey: string) {
  let childMeta = Meta(target);
  if (childMeta != null) {
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
  (<any>Array).observe(array, ArrayListener(array));
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
  } else if (Meta(value) != undefined) {
    // No-op, already wrapped!
  } else if (Array.isArray(value)) {
    WrapArray(value);
  } else if (canTrack(value)) {
    WrapObject(value);
  } else {
    // No-op, primitive!
  }
}

export function ListenWithSplice(value: any, path: string, listener: Listener) : () => void {
  if (value === null || value === undefined) {
    throw "Can't listen to null or undefined...";
  }
  Wrap(value);
  let valueMeta = Meta(value);
  if (valueMeta === undefined) {
    throw "Can't listen to primitives...";
  } else {
    return valueMeta.listen(path, listener)
  }
}

export function Listen(value: any, path: string, listener: Listener): () => void {
  return ListenWithSplice(value, path, (path: Array<string>, params: any, type: string, index: number, oldValue, newValue) => {
    switch (type) {
      case "update":
        if (oldValue == undefined) {
          listener(path, params, "create", index, undefined, newValue);
        } else if (newValue == undefined) {
          listener(path, params, "delete", index, oldValue, undefined);
        } else {
          listener(path, params, "update", index, oldValue, newValue);
        }
        break;
      case "splice":
        // Delete first descending, then update ascending, then create ascending.
        let newPath = path.slice(), pathIndex = newPath.length;
        let updateCount = Math.min(oldValue.length, newValue.length);
        
        for (let toDelete = oldValue.length - 1; toDelete >= updateCount; toDelete--) {
          newPath[pathIndex] = '' + (index + toDelete);
          listener(newPath, params, "delete", index + toDelete, oldValue[toDelete], undefined);
        }
        for (let toUpdate = 0; toUpdate < updateCount; toUpdate++) {
          newPath[pathIndex] = '' + (index + toUpdate);
          listener(newPath, params, "update", index + toUpdate, oldValue[toUpdate], newValue[toUpdate]);
        }
        for (let toCreate = updateCount; toCreate < newValue.length; toCreate++) {
          newPath[pathIndex] = '' + (index + toCreate);
          listener(newPath, params, "create", index + toCreate, undefined, newValue[toCreate]);
        }
        break;
       default:
         // TODO?
         console.log("add / remove events need to be handled?");
    }
  });
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
  let targetMeta = cast(Meta(target), ObjectMeta);
  targetMeta.directChange(name, oldValue, newValue);
}

function ArrayListener(target: Object): Function {
  return (changes => { 
    if (changes.length != 1) {
      return; // Possible?
    } else switch(changes[0].type) {
        case "update":
          handleArrayUpdate(changes[0]);
          break;
        case "splice":
          handleArraySplice(changes[0]);
          break;
        case "add":
        case "delete":
          debugger;
          console.error("Add/Delete not handled by treevent.");
          break;
    }
  });
}

function handleArrayUpdate(change: any) {
  let {name, oldValue, type, object: target} = change;
  let newValue = target[name];
  let targetMeta = cast(Meta(target), ArrayMeta);
  targetMeta.directUpdate(name, oldValue, newValue);
}

function handleArraySplice(change: any) {
  let {addedCount, index, removed: oldValues, object: target} = change;
  var newValues = target.slice(index, index + addedCount);
  let targetMeta = cast(Meta(target), ArrayMeta);
  targetMeta.directSplice(index, oldValues, newValues);
}


abstract class BaseMeta implements TreeventMeta {
  parent: any;
  parentKey: string;
  listeners: Array<{listener: Listener, parsedPath: Array<string>}>;

  constructor() {
    this.listeners = [];
  }

  attachToParent(parent: any, key: string) {
    this.parent = parent;
    this.parentKey = key;
  }

  pathChange({path = [], type, index = -1, oldValue = null, newValue = null}) {
    // TODO - use the parsed paths for indexing listeners, so this goes much faster...
    this.listeners.forEach(detail => {
      let {listener, parsedPath} = detail;
      let params = this.extractParams(path, parsedPath);
      if (params != null) {
        listener(path, params, type, index, oldValue, newValue);
      }
    });

    let parentMeta = Meta(this.parent);
    if (parentMeta != null) {
      // NOTE: reverse path instead? Have immutable version?
      path.unshift(parentMeta.keyToPath(this.parentKey)); 
      parentMeta.pathChange({path, type, index, oldValue, newValue});
    }
  }

  keyToPath(key: string): number|string { throw "abstract..."; }

  listen(path: string, listener: Listener) : ()=>void {
    let parsedPath = this.parse(path);
    this.listeners.push({listener, parsedPath});
    return function() {
      for (let at = 0; at < this.listeners.length; at++) {
        if (this.listeners[at].listener === listener) {
          this.listeners.splice(at, 1);
          return;
        }
      }
    };
  }

  parse(path: string): Array<string> {
    // NOTE: remaps a[x] to a.x before splitting. PICK: also remap a/x to a.x?
    return path.replace(new RegExp("\\[([^\\]])\\]", "g"), ".$1").split(".");
  }

  extractParams(path: Array<any>, parsedPath: Array<string>): Object {
    let pathAt = 0, params = {};
    parsedPath.every(p => {
      // PICK: use ${key} or {key} or :key etc...?
      if (p.startsWith('{') && p.endsWith('}')) {
        if (pathAt >= path.length) { return null; }
        params[p.substring(1, p.length - 1)] = path[pathAt];
        pathAt++;
      } else if (p == "*") {
        pathAt++;
      } else if (p == "**") {
        params["**"] = path.slice(pathAt);
      } else if (pathAt >= path.length || p != path[pathAt]) {
        params = null;
        return false;
      }
      return true;
    });
    return params;
  }
}


class ArrayMeta extends BaseMeta {
  target: Array<any>;
  tree: splay.Tree;

  constructor(target: Array<any>) {
    super();
    this.target = target;
    this.tree = new splay.Tree();
  }

  directUpdate(path: string, oldValue: any, newValue: any) {
    Unwrap(oldValue);
    Wrap(newValue);

    let index = +path;
    let key = this.tree.keyForIndex(index);
    reparent(newValue, this.target, key);

    this.pathChange({
      path: [path], 
      type: "update",
      oldValue, newValue
    });
  }

  directSplice(index: number, oldValue: Array<any>, newValue: Array<any>) {
    oldValue.forEach(v => Unwrap(v));
    newValue.forEach(v => Wrap(v));

    let toEdit = Math.max(oldValue.length, newValue.length);
    for (var i = 0; i < toEdit; i++) {
      let indexAt = index + i;
      if (i < oldValue.length && i < newValue.length) {
        // Old replaced with new, so switch key old -> new.
        reparent(newValue[i], this.target, this.tree.keyForIndex(indexAt));
      } else if (i < newValue.length) {
        // New added, old not removed, so insert a new one here
        let newKey = genID();
        this.tree.insertBefore(indexAt, newKey);
        reparent(newValue[i], this.target, newKey);
      } else {
        // toEdit < oldValue.length
        // Old removed, new not added, so remove the key.
        this.tree.remove(index + newValue.length);
      }
    }

    this.pathChange({
      path: [],
      type: "splice",
      index, oldValue, newValue
    });
  }

  keyToPath(key: string): number {
    return this.tree.indexForKey(key);
  }
  
  pushID(): string {
    let newId = genID();
    this.tree.push(newId);
    return newId;
  }
}

class ObjectMeta extends BaseMeta {
  target: Object;
  parent: any;
  parentKey: string;

  constructor(target: Object) {
    super();
    this.target = target;
  }

  directChange(path: string, oldValue: any, newValue: any) {
    Unwrap(oldValue);
    Wrap(newValue);
    reparent(newValue, this.target, path);
    this.pathChange({
      path: [path], 
      type: "update",
      index: -1,
      oldValue, newValue
    });
  }

  keyToPath(key: string): string {
    return key;
  }
}
