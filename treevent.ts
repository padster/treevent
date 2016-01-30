/*
Remaining:
1) Object parent-child
 a) Attachment
 b) Message passing with path
 c) Detachment
2) Array parent-child
 a) Tree structure
 b) Message passing
 c) Detachment
3) Listeners
4) Better array events
 a) Replace push/slice/...
*/

export var _sym = Symbol('treevent');

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
  for (var k in obj) {
    Wrap(obj[k]);
  }
  // EW :(
  (<any>Object).observe(obj, ObjectListener(obj));
}

export function Wrap(value: any): void {
  if (value[_sym] !== undefined) {
    // No-op, already wrapped!
  } else if (Array.isArray(value)) {
    WrapArray(value);
  } else if (canTrack(value)) {
    WrapObject(value);
  } else {
    // No-op, primitive!
  }
}

function ObjectListener(target: Object): Function {
  return (changes => changes.forEach(handleObjectChange));
}

function handleObjectChange(change: any) {
  var {name, object: target, oldValue, type} = change;
  var path = [name];
  var newValue = target[name];
  var meta: ObjectMeta = target[_sym];
  meta.handleChange(path, oldValue, newValue);
}

function ArrayListener(target: Object): Function {
  return (changes => changes.forEach(handleArrayChange));
}

function handleArrayChange(change: any) {
  var {name, object: target, oldValue, type} = change;
  var path = [name];
  var newValue = target[name];
  var meta: ArrayMeta = target[_sym];
  meta.handleChange(path, oldValue, newValue);
}



class ArrayMeta {
  target: Array<any>;

  constructor(target: Array<any>) {
    this.target = target;
  }

  handleChange(path: Array<any>, oldValue: any, newValue: any) {
    console.log("%s changes, %s -> %s", JSON.stringify(path), oldValue, newValue);
  }
}

class ObjectMeta {
  target: Object;

  constructor(target: Object) {
    this.target = target;
  }

  handleChange(path: Array<any>, oldValue: any, newValue: any) {
    console.log("%s changes, %s -> %s", JSON.stringify(path), oldValue, newValue);
  }
}
