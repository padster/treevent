// meta.ts contains all code relating to the metadata attached to treevent objects.
import splay = require('./splay');
import common = require('./common');

/** Symbol used to associate the metadata to an object. */
export let _sym = Symbol('treevent');

/** Returns metadata currently attached to a value, or undefined if none exists. */
export function Meta(target: any): TreeventMeta {
  return common.canTrack(target) ? (<TreeventMeta>target[_sym]) : undefined;
}


/** Base implementation for the metadata on a value, shared between arrays and objects. */
abstract class TreeventMeta {
  /** Parent this is attached to. */
  parent: any;

  /** Fixed token used to identify path within parent. */
  parentKey: string;

  /** Listeners currently attached to the value. */
  listeners: Array<{listener: common.Listener, parsedPath: Array<string>}>;
  
  /** Injected wrap/unwrap utilities */
  wrap: (o: any) => void;
  unwrap: (o: any) => void;

  constructor(wrappers: {wrap: (o: any) => void, unwrap: (o: any) => void}) {
    this.listeners = [];
    this.wrap = wrappers.wrap;
    this.unwrap = wrappers.unwrap;
  }

  attachToParent(parent: any, key: string) {
    this.parent = parent;
    this.parentKey = key;
  }

  /** 
   * Handles an event at a path, by looking up which listeners match, and invoking them.
   * TODO - use the parsed paths for indexing listeners, so this goes much faster!!!
   */
  pathChange({path = [], type, index = -1, oldValue = null, newValue = null}) {
    this.listeners.forEach(detail => {
      let {listener, parsedPath} = detail;
      let params = this.extractParams(path, parsedPath);
      if (params != null) {
        listener(path, params, type, index, oldValue, newValue);
      }
    });

    let parentMeta = Meta(this.parent);
    if (parentMeta != null) {
      // PICK: Pass a reversed path instead? Also: have immutable path?
      path.unshift(parentMeta.keyToPath(this.parentKey)); 
      parentMeta.pathChange({path, type, index, oldValue, newValue});
    }
  }

  /**
   * Attaches a listener to the value.
   * @return A function that, when called, removes the listener.
   */
  listen(path: string, listener: common.Listener) : () => void {
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

  /** Converts a path[type].like[0].here into a list of tokens. */
  parse(path: string): Array<string> {
    // NOTE: remaps a[x] to a.x before splitting. PICK: also remap a/x to a.x?
    return path.replace(new RegExp("\\[([^\\]])\\]", "g"), ".$1").split(".");
  }

  /**
   * Given a path, and a parsed path matcher, perform the match.
   * @return null if no match, otherwise an object containing all {param} and "**" matches.
   */
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

  wrapAndReparent(newValue: any, newParent: any, path: string) {
    this.wrap(newValue);
    reparent(newValue, newParent, path);
  }

  /** Maps a child's key token to their path. Overridden by each meta type. */
  keyToPath(key: string): number|string { throw "abstract..."; }
}



/** Metadata class for attachment to Object values. */
export class ObjectMeta extends TreeventMeta {
  target: Object;

  constructor(target: Object, wrappers: {wrap: (o: any) => void, unwrap: (o: any) => void}) {
    super(wrappers);
    this.target = target;
    for (let key in target) {
      this.wrapAndReparent(target[key], target, key);
    }
  }

  directChange(path: string, oldValue: any, newValue: any) {
    this.unwrap(oldValue);
    this.wrapAndReparent(newValue, this.target, path);
    this.pathChange({
      path: [path], 
      type: "update",
      oldValue, newValue
    });
  }

  /** Key to path is simple identity map. */
  keyToPath(key: string): string {
    return key;
  }
}


/** Metadata class for attachment to Array values. */
export class ArrayMeta extends TreeventMeta {
  target: Array<any>;
  tree: splay.Tree;

  constructor(target: Array<any>, wrappers: {wrap: (o: any) => void, unwrap: (o: any) => void}) {
    super(wrappers);
    this.target = target;
    this.tree = new splay.Tree();
    target.forEach(v => {
      this.wrapAndReparent(v, target, this.pushID());
    });
  }

  directUpdate(path: string, oldValue: any, newValue: any) {
    this.unwrap(oldValue);
    let key = this.tree.keyForIndex(+path); // NOTE: path should always be an int.
    this.wrapAndReparent(newValue, this.target, key);

    this.pathChange({
      path: [path], 
      type: "update",
      oldValue, newValue
    });
  }

  /** 
   * Handles slice event, slightly tricky - reuses existing key tokens for indices that
   * were both inserted and removed, then generates new ones for pure insertions and
   * removes pure deletions from the tree.
   */
  directSplice(index: number, oldValue: Array<any>, newValue: Array<any>) {
    oldValue.forEach(this.unwrap);
    newValue.forEach(this.wrap);

    // PICK: perform in the same order as Listen's splice handling?
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

  /** Key to path lookup gets forwarded to the tree's version. */
  keyToPath(key: string): number {
    return this.tree.indexForKey(key);
  }
  
  /** Utility to add a new ID at the end of the array. */
  pushID(): string {
    let newId = genID();
    this.tree.push(newId);
    return newId;
  }
}

/** Utility to generate a key token for an item in the splay tree. */
function genID(): string {
  let d = new Date().getTime();
  // HACK - improve. Small only for testing.
  return 'xxxxx'.replace(/x/g, function(c) {
    let r = ((d + Math.random()*16)%16) | 0;
    d = Math.floor(d/16);
    return "0123456789ABCDEF".charAt(r);
  });
}

/** Convenience method for reparenting an object, by reparenting its metadata. */
function reparent(target: any, parent: any, parentKey: string) {
  let childMeta = Meta(target);
  if (childMeta != null) {
    childMeta.attachToParent(parent, parentKey);
  }
}
