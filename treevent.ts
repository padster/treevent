// treevent.ts contains the public listening API definitions.

import common = require('./common');
import meta = require('./meta');


/**
 * Listen to a non-primitive object (possibly first wrapping it) at a given path.
 * @param value Value to listen to
 * @param path Path to listen at, can include "*", "{matchers}", and "**" match-all at the end.
 * @param listener The listener that receives the events.
 */
export function Listen(value: any, path = "**", listener: common.Listener): () => void {
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

/** 
 * Similar to Listen above, with two differences:
 *   - Emits "update" events with undefined old/new values, instead of "create" and "delete" respectively.
 *   - Emits "splice" events atomically, which merge all changes in a single splice call.
 * More complex handling logic, but closer the the underlying implementation.
 */
export function ListenWithSplice(value: any, path: string, listener: common.Listener) : () => void {
  if (value === null || value === undefined) {
    throw "Can't listen to null or undefined...";
  }
  Wrap(value);
  let valueMeta = meta.Meta(value);
  if (valueMeta === undefined) {
    throw "Can't listen to primitives...";
  } else {
    return valueMeta.listen(path, listener)
  }
}


/**
 * Wrap a JS object (and all child properties) for use within treevent.
 * NOTE: You can't wrap primitives. Arrays and Objects only.
 */
function Wrap(value: any): void {
  if (value === null || value === undefined) {
    // Ignore
  } else if (meta.Meta(value) != undefined) {
    // No-op, already wrapped!
  } else if (Array.isArray(value)) {
    value[meta._sym] = new meta.ArrayMeta(value, wrappers);
    (<any>Array).observe(value, ArrayListener(value));
  } else if (common.canTrack(value)) {
    value[meta._sym] = new meta.ObjectMeta(value, wrappers);
    (<any>Object).observe(value, ObjectListener(value));
  } else {
    // No-op, primitive!
  }
}

/**
 * Removes a JS object from treevent tracking.
 * Currently does nothing...
 */
function Unwrap(value: any): void {
  // TODO?
}

const wrappers = {wrap: Wrap, unwrap: Unwrap}; // HACK - used to inject wrap/unwrap into the meta objects.


/**
 * Generates a listener for Array.observe, translating those events
 * into ones treevent uses to update the observed array.
 */
function ArrayListener(target: Object): Function {
  return (changes => { 
    changes.forEach(change => {
      switch(change.type) {
        case "update":
          handleArrayUpdate(change);
          break;
        case "splice":
          handleArraySplice(change);
          break;
        case "add":
        case "delete":
          console.log("Add/Delete not handled by treevent.");
          break;
      }
    });
  });
}

/** Handles array updates - i.e. array[5] = {newValue}. */
function handleArrayUpdate(change: any) {
  let {name, oldValue, type, object: target} = change;
  let newValue = target[name];
  let targetMeta = common.cast(meta.Meta(target), meta.ArrayMeta);
  targetMeta.directUpdate(name, oldValue, newValue);
}

/** Handles array splices - including splice, push, pop, unshift, ... */
function handleArraySplice(change: any) {
  // TODO - for some reason, fill() isn't caught...
  let {addedCount, index, removed: oldValues, object: target} = change;
  var newValues = target.slice(index, index + addedCount);
  let targetMeta = common.cast(meta.Meta(target), meta.ArrayMeta);
  targetMeta.directSplice(index, oldValues, newValues);
}


/**
 * Generates a listener for Object.observe, translating those events
 * into ones treevent uses to update the observed object.
 */
function ObjectListener(target: Object): Function {
  return (changes => changes.forEach(handleObjectChange));
}

/** Handles object updates, including creates and deletes. */
function handleObjectChange(change: any) {
  let {name, object: target, oldValue, type} = change;
  let newValue = target[name];
  let targetMeta = common.cast(meta.Meta(target), meta.ObjectMeta);
  targetMeta.directChange(name, oldValue, newValue);
}


