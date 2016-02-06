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
      this.maybeTriggerListener(listener, path, parsedPath, type, index, oldValue, newValue);
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
    return path.replace(new RegExp("\\[([^\\]]*)\\]", "g"), ".$1").split(".");
  }

  // TODO: comment.
  maybeTriggerListener(listener: common.Listener, 
      path: Array<any>, parsedPath: Array<string>,
      type: string, index: number, oldValue: any, newValue: any) {
    let pathAt = 0, params = {};
    for (let i = 0; i < parsedPath.length; i++) {
      let p = parsedPath[i];

      // The second part is to match some.path.** when listening to some.path
      if (p == "**" || (pathAt == path.length && parsedPath[i + 1] == "**")) {
        params["**"] = path.slice(pathAt);
        listener(path, params, type, index, oldValue, newValue);
        return;

      } else if (pathAt == path.length) {
        this.maybeTriggerChildListeners(listener, path, parsedPath, i, params, type, index, oldValue, newValue);
        return;

      } else if (p.startsWith('{') && p.endsWith('}')) {;
        // PICK: use ${key} or {key} or :key etc...?
        // PICK: support or-ing? e.g. some.name|other.field
        params[p.substring(1, p.length - 1)] = path[pathAt];
      } else if (p == "*") {
        // No-op, incremented below...
      } else if (p != path[pathAt]) {
        return;
      }
      pathAt++;
    };

    if (pathAt == path.length) {
      listener(path, params, type, index, oldValue, newValue);
    }
  }

  // TODO: This is waaaay too big, should be split up...
  maybeTriggerChildListeners(listener: common.Listener, 
      path: Array<any>, parsedPath: Array<string>, pathUpTo: number, params: Object, 
      type: string, index: number, oldValue: any, newValue: any) {

    let pathRemains = CLONE(parsedPath).splice(pathUpTo);
    let oldMatches = {}, newMatches = {}, changes = {};
    let paramKey = undefined;

    switch (type) {
      case "update":
        oldMatches = this.explodeMatches(oldValue, pathRemains, 'oldValue');
        newMatches = this.explodeMatches(newValue, pathRemains, 'newValue');
        for (let oldKey in oldMatches) {
          changes[oldKey] = oldMatches[oldKey];
          if (newMatches.hasOwnProperty(oldKey)) {
            changes[oldKey].newValue = newMatches[oldKey].newValue;
            delete newMatches[oldKey];
            if (changes[oldKey].oldValue == changes[oldKey].newValue) {
              delete changes[oldKey];
            }
          }
        }
        for (let newKey in newMatches) {
          changes[newKey] = newMatches[newKey];
        }

        for (let childPath in changes) {
          let details = changes[childPath];
          let newPath = path.slice();
          newPath.push(...JSON.parse(childPath));
          let newParams = Object.assign({}, params, details.params);
          listener(newPath, params, "update", index, details.oldValue, details.newValue);
        }
        break;

      case "splice":
        let p = pathRemains[0];
        if (p == "**") {
          console.error("** on deep child match unsupported so far...");
          return;
        }

        let childPathRemains = CLONE(pathRemains).splice(1);

        let updateCount = Math.min(oldValue.length, newValue.length);
        for (let i = oldValue.length - 1; i >= updateCount; i--) {
          paramKey = p.startsWith('{') && p.endsWith('}') ? p.substring(1, p.length - 1) : undefined;

          if (paramKey !== undefined || p == ('' + i) || p == '*') { 
            oldMatches = this.explodeMatches(oldValue[i], childPathRemains, 'oldValue');
            for (let oldKey in oldMatches) {
              let fixedKey = unshiftPathJSON(i + index, oldKey);
              changes[fixedKey] = oldMatches[oldKey];
              if (paramKey !== undefined) {
                changes[fixedKey].params = changes[fixedKey].params || {};
                changes[fixedKey].params[paramKey] = i + index;
              }
            }
          }
        }
        for (let i = 0; i < updateCount; i++) {
          paramKey = p.startsWith('{') && p.endsWith('}') ? p.substring(1, p.length - 1) : undefined;

          if (paramKey !== undefined || p == ('' + i) || p == '*') { 
            oldMatches = this.explodeMatches(oldValue[i], childPathRemains, 'oldValue');
            newMatches = this.explodeMatches(newValue[i], childPathRemains, 'newValue');

            for (let oldKey in oldMatches) {
              let fixedKey = unshiftPathJSON(i + index, oldKey);
              changes[fixedKey] = oldMatches[oldKey];
              if (paramKey !== undefined) {
                changes[fixedKey].params = changes[fixedKey].params || {};
                changes[fixedKey].params[paramKey] = i + index;
              }
              if (newMatches.hasOwnProperty(oldKey)) {
                changes[fixedKey].newValue = newMatches[oldKey].newValue;
                delete newMatches[oldKey];
                if (changes[fixedKey].oldValue == changes[fixedKey].newValue) {
                  delete changes[fixedKey];
                }
              }
            }
            for (let newKey in newMatches) {
              let fixedKey = unshiftPathJSON(i + index, newKey);
              changes[fixedKey] = newMatches[newKey];
              if (paramKey !== undefined) {
                changes[fixedKey].params = changes[fixedKey].params || {};
                changes[fixedKey].params[paramKey] = i + index;
              }
            }
          }
        }
        for (let i = updateCount; i < newValue.length; i++) {
          paramKey = p.startsWith('{') && p.endsWith('}') ? p.substring(1, p.length - 1) : undefined;

          if (paramKey !== undefined || p == ('' + i) || p == '*') { 
            newMatches = this.explodeMatches(newValue[i], childPathRemains, 'newValue');
            for (var newKey in newMatches) {
              let fixedKey = unshiftPathJSON(i + index, newKey);
              changes[fixedKey] = newMatches[newKey];
              if (paramKey !== undefined) {
                changes[fixedKey].params = changes[fixedKey].params || {};
                changes[fixedKey].params[paramKey] = i + index;
              }
            }
          }
        }

        for (var childPath in changes) {
          let details = changes[childPath];
          let newPath = CLONE(path);
          newPath.push(...JSON.parse(childPath));
          let newParams = Object.assign({}, params, details.params);
          listener(newPath, newParams, "update", -1, details.oldValue, details.newValue);
        }

        break;

      default:
        console.error("Unknown supported object change type: " + type);
    }
  }
  
  /**
   * Given a position, and a path to match, go down to obtain all matches.
   * Return a result object, mapping [match path array] => {
   *   params: match params for this child path
   *   valueKey: value at this position
   * }
   */
  explodeMatches(target: any, path: Array<string>, valueKey: string): Object {
    let result = {};
    this.collectMatches(result, target, undefined, [], path, valueKey);
    return result;
  }

  collectMatches(collector: Object, target, paramsAt: Object, 
      pathAt: Array<string>, pathLeft: Array<string>, valueKey: string) {
    if (pathLeft.length == 0) {
      let solution = {};
      if (paramsAt != undefined) {
        solution['params'] = paramsAt;
      }
      solution[valueKey] = target;
      collector[JSON.stringify(pathAt)] = solution;
      return;
    }

    let p = pathLeft[0];

    if (p == "**") {
      // PICK - either this, or explode EVERYTHING.
      console.log("** match on whole-object change unsupported (too expensive? try to optimize...");
      return;
    } else if (p.startsWith('{') && p.endsWith('}')) {
      // PICK: use ${key} or {key} or :key etc...?
      let paramsKey = p.substring(1, p.length - 1);
      let newParams = CLONE(paramsAt) || {};
      let newPath = CLONE(pathAt); newPath.push(undefined);
      for (let key in target) {
        newParams[paramsKey] = key; 
        newPath[newPath.length - 1] = key;
        this.collectMatches(collector, target[key], newParams, newPath, pathLeft.slice(1), valueKey);
      }      
    } else if (p == "*") {
      let newPath = CLONE(pathAt); newPath.push(undefined);
      for (let key in target) {
        newPath[newPath.length - 1] = key;
        this.collectMatches(collector, target[key], paramsAt, newPath, pathLeft.slice(1), valueKey);
      }
    } else {
      let next = target == undefined ? undefined : target[p];
      let newPath = CLONE(pathAt); newPath.push(p);
      this.collectMatches(collector, next, paramsAt, newPath, pathLeft.slice(1), valueKey); 
    }
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

function CLONE(target: any): any {
  return JSON.parse(JSON.stringify(target));
}

function unshiftPathJSON(newPath: number|string, pathJSON: string): string {
  let parsed = JSON.parse(pathJSON);
  parsed.unshift(newPath);
  return JSON.stringify(parsed);
}