// util.ts contains a collection of common utilities built on top of treevent.

import treevent = require('./treevent');

/**
 * Given an array of objects, and a function, map it to a second array using the function.
 */
export function LiveMap<I, O>(input: Array<I>, f: (item: I) => O ): Array<O> {
  let result = input.map(f);
  treevent.Listen(input, "{id}.**", (path, params, type, index, oldValue, newValue) => {
    let indexChanged = +path[0];
    if (oldValue === undefined) {
      result.splice(indexChanged, 0, f(input[indexChanged]));
    } else if (newValue === undefined) {
      result.splice(indexChanged, 1);
    } else {
      result[indexChanged] = f(input[indexChanged]);
    }
  });
  return result;
}